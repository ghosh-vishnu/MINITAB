"""
Serializers for charts.
"""
from rest_framework import serializers
from .models import Chart


class ChartSerializer(serializers.ModelSerializer):
    """
    Serializer for Chart model.
    """
    spreadsheet_name = serializers.CharField(source='spreadsheet.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Chart
        fields = (
            'id', 'spreadsheet', 'spreadsheet_name', 'user', 'user_username',
            'chart_type', 'title', 'x_axis_column', 'y_axis_columns',
            'config', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')


class ChartDataSerializer(serializers.Serializer):
    """
    Serializer for chart data response.
    """
    labels = serializers.ListField(child=serializers.CharField())
    datasets = serializers.ListField(child=serializers.DictField())


