"""
Serializers for analysis.
"""
from rest_framework import serializers
from .models import Analysis


class AnalysisSerializer(serializers.ModelSerializer):
    """
    Serializer for Analysis model.
    """
    spreadsheet_name = serializers.CharField(source='spreadsheet.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Analysis
        fields = (
            'id', 'spreadsheet', 'spreadsheet_name', 'user', 'user_username',
            'analysis_type', 'selected_columns', 'parameters', 'results',
            'created_at'
        )
        read_only_fields = ('id', 'user', 'created_at')


class AnalysisCreateSerializer(serializers.Serializer):
    """
    Serializer for creating analysis.
    """
    analysis_type = serializers.ChoiceField(choices=Analysis.ANALYSIS_TYPE_CHOICES)
    selected_columns = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    parameters = serializers.DictField(required=False, allow_empty=True)
    
    def validate(self, attrs):
        analysis_type = attrs.get('analysis_type')
        parameters = attrs.get('parameters', {})
        
        # Validate regression parameters
        if analysis_type == 'regression':
            if 'x_column' not in parameters or 'y_column' not in parameters:
                raise serializers.ValidationError(
                    "Regression requires 'x_column' and 'y_column' in parameters"
                )
        
        return attrs



