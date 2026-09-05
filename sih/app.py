from flask import Flask, request, jsonify
import pandas as pd
import io
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def get_readiness_score(row):
    # CRITICAL FIX: Immediately check for "Expired" status
    cert_status = row.get('Cert_Status', '').strip().lower()
    if cert_status == 'expired':
        return 20 # Hard cap on score for expired certificates

    factors = ['Certification', 'Branding', 'Mileage_Score', 'Depot', 'Maintenance', 'Cleaning']
    
    # Create a mutable copy of the row
    tempRow = row.copy()
    
    # Apply business rules for other factors
    if tempRow.get('Maintenance_Status') == 'Upcoming': tempRow['Maintenance'] = 40
    if tempRow.get('Maintenance_Status') == 'Not Now': tempRow['Maintenance'] = 60
    
    # Set the Certification score based on the Cert_Status
    tempRow['Certification'] = 100 
    
    total_score = 0
    factor_count = 0
    
    for factor in factors:
        value = tempRow.get(factor)
        if value is not None and not pd.isna(value):
            try:
                score = float(value)
                total_score += score
                factor_count += 1
            except (ValueError, TypeError):
                continue
    
    readiness_score = total_score / factor_count if factor_count > 0 else 0
    
    # Round to the nearest whole number
    return int(round(readiness_score))

@app.route('/predict_plan', methods=['POST'])
def predict_plan():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        df_new = pd.read_csv(io.StringIO(file.stream.read().decode("UTF8")), on_bad_lines='skip')
        
        # Calculate scores using the simple average of factors
        df_new['Readiness_Score'] = df_new.apply(get_readiness_score, axis=1)
        
    except Exception as e:
        return jsonify({"error": f"Error during processing: {str(e)}"}), 500
    
    df_new = df_new.sort_values(by='Readiness_Score', ascending=False)
    
    # Add a 'Certification' factor to the output to make it consistent
    df_new['Certification'] = df_new.apply(lambda row: 0 if row['Cert_Status'] == 'Expired' else 100, axis=1)
    
    result = df_new.to_dict(orient='records')
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5000, debug=True)