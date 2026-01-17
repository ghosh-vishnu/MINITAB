"""
Services for spreadsheet data operations.
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class DataEngineService:
    """
    Service for handling spreadsheet data operations using Pandas.
    """
    
    @staticmethod
    def cells_to_dataframe(cells: List[Dict]) -> pd.DataFrame:
        """
        Convert list of cell dictionaries to Pandas DataFrame.
        
        Args:
            cells: List of cell dictionaries with row_index, column_index, value
            
        Returns:
            Pandas DataFrame
        """
        if not cells:
            return pd.DataFrame()
        
        # Create a dictionary to store cell values
        data_dict = {}
        max_row = 0
        max_col = 0
        
        for cell in cells:
            row = cell['row_index']
            col = cell['column_index']
            value = cell.get('value', '')
            
            if row not in data_dict:
                data_dict[row] = {}
            
            data_dict[row][col] = value
            max_row = max(max_row, row)
            max_col = max(max_col, col)
        
        # Create DataFrame with proper dimensions
        if max_row >= 0 and max_col >= 0:
            df = pd.DataFrame(index=range(max_row + 1), columns=range(max_col + 1))
            df = df.fillna('')
            
            # Fill in values
            for row_idx, cols in data_dict.items():
                for col_idx, value in cols.items():
                    df.at[row_idx, col_idx] = value
            
            return df
        else:
            return pd.DataFrame()
    
    @staticmethod
    def dataframe_to_cells(df: pd.DataFrame, spreadsheet_id: str) -> List[Dict]:
        """
        Convert Pandas DataFrame to list of cell dictionaries.
        
        Args:
            df: Pandas DataFrame
            spreadsheet_id: UUID of the spreadsheet
            
        Returns:
            List of cell dictionaries
        """
        cells = []
        
        # Convert DataFrame index to list for easier iteration
        row_indices = list(df.index)
        
        # Add all rows - use actual row position in DataFrame (0-based)
        for row_pos, row_idx in enumerate(row_indices):
            for col_idx, col_name in enumerate(df.columns):
                value = df.at[row_idx, col_name]
                
                # Skip empty/NaN cells to reduce storage
                if pd.isna(value) or value == '':
                    continue
                
                # Determine data type BEFORE converting to string
                data_type = 'text'
                # Check for numeric types (including numpy types)
                if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
                    data_type = 'number'
                    value = str(value)  # Convert to string after identifying as number
                elif isinstance(value, pd.Timestamp):
                    data_type = 'date'
                    value = value.isoformat()
                else:
                    value = str(value)
                
                # Add cell with row position (0-based indexing)
                cells.append({
                    'spreadsheet_id': spreadsheet_id,
                    'row_index': row_pos,  # Use position in DataFrame (0, 1, 2, ...)
                    'column_index': col_idx,
                    'value': value,
                    'data_type': data_type,
                })
        
        return cells
    
    @staticmethod
    def import_from_csv(file_content: bytes) -> pd.DataFrame:
        """
        Import data from CSV file.
        
        Args:
            file_content: CSV file content as bytes
            
        Returns:
            Pandas DataFrame
        """
        try:
            print(f"[DataEngineService] import_from_csv called")
            print(f"[DataEngineService] file_content type: {type(file_content)}, size: {len(file_content) if isinstance(file_content, bytes) else 'N/A'}")
            
            df = pd.read_csv(BytesIO(file_content))
            print(f"[DataEngineService] Successfully read CSV, shape: {df.shape}")
            return df
        except Exception as e:
            print(f"[DataEngineService] Error importing CSV: {str(e)}")
            logger.error(f"Error importing CSV: {str(e)}")
            raise ValueError(f"Failed to import CSV: {str(e)}")
    
    @staticmethod
    def import_from_excel(file_content: bytes, sheet_name: Optional[str] = None) -> pd.DataFrame:
        """
        Import data from Excel file.
        
        Args:
            file_content: Excel file content as bytes
            sheet_name: Optional sheet name (defaults to first sheet)
            
        Returns:
            Pandas DataFrame
        """
        try:
            print(f"[DataEngineService] import_from_excel called with sheet_name={sheet_name} (type={type(sheet_name)})")
            print(f"[DataEngineService] file_content type: {type(file_content)}, size: {len(file_content) if isinstance(file_content, bytes) else 'N/A'}")
            
            # Handle None and 'None' string
            if sheet_name == 'None' or (isinstance(sheet_name, str) and sheet_name.lower() == 'none'):
                sheet_name = None
            
            # Read Excel file
            excel_data = pd.read_excel(BytesIO(file_content), sheet_name=sheet_name, engine='openpyxl')
            
            # If sheet_name is None, pd.read_excel returns a dict of {sheet_name: DataFrame}
            # We need to handle this case and return the first sheet
            if isinstance(excel_data, dict):
                if len(excel_data) == 0:
                    raise ValueError("Excel file contains no sheets")
                # Get the first sheet if no specific sheet was requested
                first_sheet_name = list(excel_data.keys())[0]
                df = excel_data[first_sheet_name]
                print(f"[DataEngineService] Multiple sheets found, using first sheet: {first_sheet_name}")
            elif isinstance(excel_data, pd.DataFrame):
                df = excel_data
            else:
                raise ValueError(f"Unexpected data type returned from pd.read_excel: {type(excel_data)}")
            
            print(f"[DataEngineService] Successfully read Excel, shape: {df.shape}")
            return df
        except Exception as e:
            print(f"[DataEngineService] Error importing Excel: {str(e)}")
            logger.error(f"Error importing Excel: {str(e)}")
            raise ValueError(f"Failed to import Excel: {str(e)}")
    
    @staticmethod
    def export_to_csv(df: pd.DataFrame) -> bytes:
        """
        Export DataFrame to CSV format.
        
        Args:
            df: Pandas DataFrame
            
        Returns:
            CSV content as bytes
        """
        buffer = BytesIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def export_to_excel(df: pd.DataFrame) -> bytes:
        """
        Export DataFrame to Excel format.
        
        Args:
            df: Pandas DataFrame
            
        Returns:
            Excel content as bytes
        """
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        buffer.seek(0)
        return buffer.getvalue()
    
    @staticmethod
    def evaluate_formula(formula: str, df: pd.DataFrame, row: int, col: int) -> Optional[float]:
        """
        Evaluate a formula in the context of a DataFrame.
        
        Supported formulas:
        - SUM(range): Sum of values in range
        - AVG(range): Average of values in range
        - MIN(range): Minimum value in range
        - MAX(range): Maximum value in range
        
        Args:
            formula: Formula string (e.g., "=SUM(A1:A10)")
            df: Pandas DataFrame
            row: Current row index
            col: Current column index
            
        Returns:
            Calculated value or None
        """
        try:
            formula = formula.strip()
            if not formula.startswith('='):
                return None
            
            formula = formula[1:].strip().upper()
            
            # Parse range (e.g., A1:A10)
            def parse_range(range_str: str) -> Tuple[int, int, int, int]:
                """Parse Excel-style range to row/column indices."""
                # Simple implementation - can be extended
                # For now, assume format like A1:A10
                parts = range_str.split(':')
                if len(parts) != 2:
                    return None
                
                # Convert Excel column letters to numbers
                def col_letter_to_num(letters: str) -> int:
                    num = 0
                    for char in letters:
                        if char.isalpha():
                            num = num * 26 + (ord(char.upper()) - ord('A') + 1)
                    return num - 1
                
                start = parts[0]
                end = parts[1]
                
                # Extract column and row from start
                start_col_letters = ''.join([c for c in start if c.isalpha()])
                start_row = int(''.join([c for c in start if c.isdigit()])) - 1
                start_col = col_letter_to_num(start_col_letters)
                
                # Extract column and row from end
                end_col_letters = ''.join([c for c in end if c.isalpha()])
                end_row = int(''.join([c for c in end if c.isdigit()])) - 1
                end_col = col_letter_to_num(end_col_letters)
                
                return (start_row, start_col, end_row, end_col)
            
            # Extract function name and range
            if '(' in formula and ')' in formula:
                func_name = formula.split('(')[0].strip()
                range_str = formula.split('(')[1].split(')')[0].strip()
                
                range_coords = parse_range(range_str)
                if not range_coords:
                    return None
                
                start_row, start_col, end_row, end_col = range_coords
                
                # Extract values from range
                values = []
                for r in range(start_row, end_row + 1):
                    for c in range(start_col, end_col + 1):
                        if r < len(df.index) and c < len(df.columns):
                            val = df.at[r, c]
                            try:
                                num_val = float(val)
                                values.append(num_val)
                            except (ValueError, TypeError):
                                pass
                
                if not values:
                    return None
                
                # Apply function
                if func_name == 'SUM':
                    return sum(values)
                elif func_name == 'AVG' or func_name == 'AVERAGE':
                    return sum(values) / len(values)
                elif func_name == 'MIN':
                    return min(values)
                elif func_name == 'MAX':
                    return max(values)
            
            return None
        except Exception as e:
            logger.error(f"Error evaluating formula {formula}: {str(e)}")
            return None



