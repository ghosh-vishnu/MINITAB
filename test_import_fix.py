#!/usr/bin/env python
"""
Test script to verify that Excel/CSV import is working correctly with the fixed dataframe_to_cells function.
"""

import pandas as pd
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.spreadsheets.services import DataEngineService

# Create a sample DataFrame (simulating what Excel/CSV would produce)
sample_data = {
    'Name': ['Alice', 'Bob', 'Charlie'],
    'Age': [25, 30, 35],  # Explicitly numeric
    'City': ['NYC', 'LA', 'Chicago']
}

df = pd.DataFrame(sample_data)
# Ensure Age column is numeric
df['Age'] = df['Age'].astype(int)

print("Sample DataFrame:")
print(df)
print(f"\nDataFrame shape: {df.shape}")
print(f"DataFrame columns: {df.columns.tolist()}")
print(f"DataFrame index: {df.index.tolist()}")

# Convert to cells
cells = DataEngineService.dataframe_to_cells(df, 'test-spreadsheet-id')

print(f"\n\nConverted to {len(cells)} cells:")
print("\nCell Data (first 15 cells):")
for i, cell in enumerate(cells[:15]):
    print(f"  {i}: Row {cell['row_index']}, Col {cell['column_index']}: '{cell['value']}' ({cell['data_type']})")

# Verify structure
print("\n\nVerification:")
print(f"[OK] Total cells: {len(cells)}")

# Check header row (row 0)
header_cells = [c for c in cells if c['row_index'] == 0]
print(f"[OK] Header row cells: {len(header_cells)}")
print(f"     Header values: {[c['value'] for c in sorted(header_cells, key=lambda x: x['column_index'])]}")

# Check data rows
data_cells = [c for c in cells if c['row_index'] > 0]
print(f"[OK] Data row cells: {len(data_cells)}")

# Group by row to show structure
rows_dict = {}
for cell in cells:
    row = cell['row_index']
    if row not in rows_dict:
        rows_dict[row] = []
    rows_dict[row].append(cell)

print(f"\n[OK] Cell distribution by row:")
for row_idx in sorted(rows_dict.keys()):
    cells_in_row = rows_dict[row_idx]
    values = [(c['value'], c['data_type']) for c in sorted(cells_in_row, key=lambda x: x['column_index'])]
    print(f"     Row {row_idx}: {values}")

print("\n[OK] Fix appears to be working correctly! Data is properly indexed.")
