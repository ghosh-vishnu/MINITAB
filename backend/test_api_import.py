import requests
import pandas as pd
from io import BytesIO
import json

# Create a test Excel file
data = {'Name': ['Alice', 'Bob'], 'Age': [25, 30]}
df = pd.DataFrame(data)
buffer = BytesIO()
df.to_excel(buffer, index=False, engine='openpyxl')
buffer.seek(0)

# Get auth token first
login_response = requests.post(
    'http://localhost:8000/api/auth/login/',
    json={
        'email': 'test@example.com',
        'password': 'Test@1234'
    }
)

if login_response.status_code == 200:
    tokens = login_response.json()
    access_token = tokens.get('access')
    print(f"Login successful, access token: {access_token[:20]}...")
    
    # Create a spreadsheet
    headers = {'Authorization': f'Bearer {access_token}'}
    create_response = requests.post(
        'http://localhost:8000/api/spreadsheets/',
        json={'name': 'Test Spreadsheet', 'row_count': 100, 'column_count': 26},
        headers=headers
    )
    
    if create_response.status_code == 201:
        spreadsheet = create_response.json()
        spreadsheet_id = spreadsheet['id']
        print(f"Spreadsheet created: {spreadsheet_id}")
        
        # Try to import Excel
        buffer.seek(0)
        files = {'file': ('test.xlsx', buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        import_response = requests.post(
            f'http://localhost:8000/api/spreadsheets/{spreadsheet_id}/import_excel/',
            files=files,
            headers=headers
        )
        
        print(f"Import response status: {import_response.status_code}")
        print(f"Import response: {import_response.text}")
    else:
        print(f"Failed to create spreadsheet: {create_response.status_code}")
        print(f"Response: {create_response.text}")
else:
    print(f"Login failed: {login_response.status_code}")
    print(f"Response: {login_response.text}")
