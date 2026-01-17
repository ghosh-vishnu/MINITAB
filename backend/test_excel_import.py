import pandas as pd
from io import BytesIO
import openpyxl

# Create a simple test Excel file
data = {'Name': ['Alice', 'Bob'], 'Age': [25, 30]}
df = pd.DataFrame(data)

# Save to bytes
buffer = BytesIO()
df.to_excel(buffer, index=False, engine='openpyxl')
buffer.seek(0)

# Try to read it back
try:
    file_content = buffer.getvalue()
    print(f"File size: {len(file_content)} bytes")
    
    df_read = pd.read_excel(BytesIO(file_content), sheet_name=None)
    print(f"Successfully read Excel file with sheet_name=None")
    print(f"Sheets: {list(df_read.keys())}")
    
    # Try with sheet name
    df_read2 = pd.read_excel(BytesIO(file_content), sheet_name=0)
    print(f"Successfully read Excel file with sheet_name=0")
    print(f"Data shape: {df_read2.shape}")
    print(f"Data:\n{df_read2}")
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()
