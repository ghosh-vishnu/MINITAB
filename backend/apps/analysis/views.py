"""
Views for data analysis.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Analysis
from .serializers import AnalysisSerializer, AnalysisCreateSerializer
from .services import AnalysisService
from apps.spreadsheets.models import Spreadsheet
from apps.spreadsheets.services import DataEngineService


class AnalysisViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Analysis operations.
    """
    queryset = Analysis.objects.all()
    serializer_class = AnalysisSerializer
    
    def get_queryset(self):
        """
        Filter analyses by current user.
        """
        user = self.request.user
        return Analysis.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """
        Set the user when creating an analysis.
        """
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def perform_analysis(self, request):
        """
        Perform statistical analysis on spreadsheet data.
        """
        serializer = AnalysisCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        spreadsheet_id = request.data.get('spreadsheet_id')
        if not spreadsheet_id:
            return Response(
                {'error': 'spreadsheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        spreadsheet = get_object_or_404(
            Spreadsheet,
            id=spreadsheet_id,
            user=request.user
        )
        
        # Get cells and convert to DataFrame
        cells = spreadsheet.cells.all()
        cells_data = [
            {
                'row_index': cell.row_index,
                'column_index': cell.column_index,
                'value': cell.value or '',
            }
            for cell in cells
        ]
        
        df = DataEngineService.cells_to_dataframe(cells_data)
        
        if df.empty:
            return Response(
                {'error': 'Spreadsheet is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform analysis based on type
        analysis_type = serializer.validated_data['analysis_type']
        selected_columns = serializer.validated_data['selected_columns']
        parameters = serializer.validated_data.get('parameters', {})
        
        try:
            if analysis_type == 'summary_stats':
                results = AnalysisService.calculate_summary_statistics(df, selected_columns)
            elif analysis_type == 'correlation':
                if len(selected_columns) < 2:
                    return Response(
                        {'error': 'Correlation requires at least 2 columns'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                results = AnalysisService.calculate_correlation(df, selected_columns)
            elif analysis_type == 'regression':
                x_column = parameters.get('x_column')
                y_column = parameters.get('y_column')
                if x_column is None or y_column is None:
                    return Response(
                        {'error': 'Regression requires x_column and y_column'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                results = AnalysisService.calculate_linear_regression(df, x_column, y_column)
            elif analysis_type == 'custom':
                operation = parameters.get('operation', 'sum')
                results = AnalysisService.calculate_custom_analysis(df, selected_columns, operation)
            else:
                return Response(
                    {'error': f'Unknown analysis type: {analysis_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Save analysis
            analysis = Analysis.objects.create(
                spreadsheet=spreadsheet,
                user=request.user,
                analysis_type=analysis_type,
                selected_columns=selected_columns,
                parameters=parameters,
                results=results
            )
            
            return Response(
                {
                    'analysis': AnalysisSerializer(analysis).data,
                    'results': results
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """
        Get analysis results.
        """
        analysis = self.get_object()
        return Response({
            'analysis': AnalysisSerializer(analysis).data,
            'results': analysis.results
        })


