"""
Services for data analysis operations.
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    Service for performing statistical analysis on spreadsheet data.
    """
    
    @staticmethod
    def calculate_summary_statistics(df: pd.DataFrame, columns: List[int]) -> Dict:
        """
        Calculate summary statistics for selected columns.
        
        Args:
            df: Pandas DataFrame
            columns: List of column indices
            
        Returns:
            Dictionary with statistics for each column
        """
        results = {}
        
        for col_idx in columns:
            if col_idx not in df.columns:
                continue
            
            col_data = df[col_idx]
            
            # Convert to numeric, ignoring non-numeric values
            numeric_data = pd.to_numeric(col_data, errors='coerce').dropna()
            
            if len(numeric_data) == 0:
                results[col_idx] = {
                    'error': 'No numeric data found in column'
                }
                continue
            
            # Calculate statistics
            stats_dict = {
                'count': len(numeric_data),
                'mean': float(numeric_data.mean()),
                'median': float(numeric_data.median()),
                'mode': float(numeric_data.mode()[0]) if len(numeric_data.mode()) > 0 else None,
                'std_dev': float(numeric_data.std()),
                'variance': float(numeric_data.var()),
                'min': float(numeric_data.min()),
                'max': float(numeric_data.max()),
                'range': float(numeric_data.max() - numeric_data.min()),
                'q1': float(numeric_data.quantile(0.25)),
                'q3': float(numeric_data.quantile(0.75)),
                'iqr': float(numeric_data.quantile(0.75) - numeric_data.quantile(0.25)),
            }
            
            results[col_idx] = stats_dict
        
        return results
    
    @staticmethod
    def calculate_correlation(df: pd.DataFrame, columns: List[int]) -> Dict:
        """
        Calculate correlation matrix for selected columns.
        
        Args:
            df: Pandas DataFrame
            columns: List of column indices
            
        Returns:
            Correlation matrix as dictionary
        """
        # Filter to selected columns
        selected_df = df[columns]
        
        # Convert to numeric
        numeric_df = selected_df.apply(pd.to_numeric, errors='coerce')
        
        # Calculate correlation
        corr_matrix = numeric_df.corr()
        
        # Convert to dictionary format
        results = {
            'columns': columns,
            'correlation_matrix': corr_matrix.to_dict(),
            'pairs': []
        }
        
        # Generate pair-wise correlations
        for i, col1 in enumerate(columns):
            for j, col2 in enumerate(columns):
                if i < j:  # Avoid duplicates
                    corr_value = corr_matrix.at[col1, col2]
                    if not pd.isna(corr_value):
                        results['pairs'].append({
                            'column1': col1,
                            'column2': col2,
                            'correlation': float(corr_value)
                        })
        
        return results
    
    @staticmethod
    def calculate_linear_regression(df: pd.DataFrame, x_column: int, y_column: int) -> Dict:
        """
        Perform simple linear regression.
        
        Args:
            df: Pandas DataFrame
            x_column: Independent variable column index
            y_column: Dependent variable column index
            
        Returns:
            Regression results dictionary
        """
        if x_column not in df.columns or y_column not in df.columns:
            raise ValueError("Column indices out of range")
        
        # Extract columns and convert to numeric
        x_data = pd.to_numeric(df[x_column], errors='coerce').dropna()
        y_data = pd.to_numeric(df[y_column], errors='coerce').dropna()
        
        # Align indices
        common_indices = x_data.index.intersection(y_data.index)
        x_aligned = x_data.loc[common_indices]
        y_aligned = y_data.loc[common_indices]
        
        if len(x_aligned) < 2:
            raise ValueError("Insufficient data points for regression")
        
        # Perform linear regression using scipy
        slope, intercept, r_value, p_value, std_err = stats.linregress(x_aligned, y_aligned)
        
        # Calculate R-squared
        r_squared = r_value ** 2
        
        # Calculate predicted values
        y_pred = slope * x_aligned + intercept
        
        # Calculate residuals
        residuals = y_aligned - y_pred
        
        results = {
            'x_column': x_column,
            'y_column': y_column,
            'slope': float(slope),
            'intercept': float(intercept),
            'r_value': float(r_value),
            'r_squared': float(r_squared),
            'p_value': float(p_value),
            'std_err': float(std_err),
            'equation': f'y = {slope:.4f}x + {intercept:.4f}',
            'n': len(x_aligned),
            'residuals': {
                'mean': float(residuals.mean()),
                'std': float(residuals.std()),
            }
        }
        
        return results
    
    @staticmethod
    def calculate_custom_analysis(df: pd.DataFrame, columns: List[int], operation: str) -> Dict:
        """
        Perform custom analysis operations.
        
        Args:
            df: Pandas DataFrame
            columns: List of column indices
            operation: Operation to perform (e.g., 'sum', 'product', 'difference')
            
        Returns:
            Analysis results
        """
        results = {}
        
        for col_idx in columns:
            if col_idx not in df.columns:
                continue
            
            col_data = df[col_idx]
            numeric_data = pd.to_numeric(col_data, errors='coerce').dropna()
            
            if len(numeric_data) == 0:
                continue
            
            if operation == 'sum':
                results[col_idx] = {'sum': float(numeric_data.sum())}
            elif operation == 'product':
                results[col_idx] = {'product': float(numeric_data.prod())}
            elif operation == 'difference':
                results[col_idx] = {'difference': float(numeric_data.max() - numeric_data.min())}
            else:
                results[col_idx] = {'error': f'Unknown operation: {operation}'}
        
        return results



