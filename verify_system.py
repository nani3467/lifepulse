import json
import urllib.request
import urllib.error
import time

API_URL = "http://127.0.0.1:5000/api"

def make_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
        
    req = urllib.request.Request(f"{API_URL}{url}", data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode("utf-8")
            return status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8")
        try:
            err_json = json.loads(body)
        except Exception:
            err_json = {"error": body}
        return status, err_json

def test_system():
    print("--- LifePulse Doctor System Verification Test ---")
    
    # 1. Register a Doctor Request
    ts = int(time.time())
    test_email = f"verified_doc_{ts}@lifepulse.com"
    test_phone = f"+1 555-{ts % 10000:04d}"
    reg_payload = {
        "name": "Dr. Verification Test",
        "email": test_email,
        "password": "Password@123",
        "phone": test_phone,
        "dob": "1980-05-15",
        "gender": "male",
        "medical_reg_number": "MRN-999888",
        "medical_council_reg_id": "MCI-777666",
        "qualification": "MD Cardiology",
        "highest_degree": "MD",
        "university_name": "Stanford University",
        "graduation_year": 2008,
        "experience_years": 18,
        "specialization": "Cardiology",
        "hospital_name": "Apollo Hospital",
        "consultation_fee": 750.0,
        "available_days": "Mon,Wed,Fri",
        "available_slots": "09:00 - 10:00, 10:00 - 11:00",
        "consultation_types": "in_person,video",
        "bio": "Cardiologist specialist testing integration.",
        "license_file": "license_test.pdf",
        "certificate_file": "cert_test.pdf",
        "gov_id_file": "govid_test.pdf"
    }
    
    print("\n[Step 1] Submitting doctor registration request...")
    status, res = make_request("/auth/doctor-register", method="POST", data=reg_payload)
    print(f"Status: {status}")
    print(f"Response: {json.dumps(res, indent=2)}")
    if status != 201:
        print("[Error] Failed to submit registration request.")
        return

    # 2. Login as Admin
    print("\n[Step 2] Logging in as Admin...")
    admin_login = {
        "email": "admin@lifepulse.com",
        "password": "Admin@123"
    }
    status, res = make_request("/auth/login", method="POST", data=admin_login)
    print(f"Status: {status}")
    if status != 200:
        print("[Error] Failed to log in as Admin.")
        return
        
    access_token = res["access_token"]
    admin_headers = {"Authorization": f"Bearer {access_token}"}
    print("[Success] Logged in as Admin. Token obtained.")

    # 3. Retrieve Pending Doctor Requests
    print("\n[Step 3] Fetching pending doctor requests...")
    status, res = make_request("/admin/doctor-requests", method="GET", headers=admin_headers)
    print(f"Status: {status}")
    reqs = res.get("requests", [])
    target_req = None
    for r in reqs:
        if r["email"] == test_email:
            target_req = r
            break
            
    if not target_req:
        print("[Error] Could not find the submitted request in pending list.")
        return
        
    print(f"[Success] Found request ID: {target_req['id']} for {test_email}")

    # 4. Approve the Doctor Request
    req_id = target_req["id"]
    print(f"\n[Step 4] Approving doctor request ID {req_id}...")
    status, res = make_request(f"/admin/doctor-requests/{req_id}/approve", method="POST", headers=admin_headers)
    print(f"Status: {status}")
    print(f"Response: {json.dumps(res, indent=2)}")
    if status != 200:
        print("[Error] Approval failed.")
        return
        
    doctor_code = res["doctor"]["doctor_code"]
    print(f"[Success] Request approved. Generated Doctor Code / ID: {doctor_code}")

    # 5. Login as the newly approved Doctor using Doctor Code
    print(f"\n[Step 5] Attempting login using Doctor Code '{doctor_code}'...")
    doc_login = {
        "email": doctor_code,  # The login accepts Email or Doctor Code in 'email' field
        "password": "Password@123"
    }
    status, res = make_request("/auth/login", method="POST", data=doc_login)
    print(f"Status: {status}")
    print(f"Response: {json.dumps(res, indent=2)}")
    if status != 200:
        print("[Error] Doctor Code login failed.")
        return
        
    print(f"[Success] Doctor successfully logged in using Doctor Code!")
    
    # 6. Fetch Doctor Profile via /me endpoint
    doc_token = res["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("\n[Step 6] Verifying doctor details from /me profile endpoint...")
    status, res = make_request("/auth/me", method="GET", headers=doc_headers)
    print(f"Status: {status}")
    print(f"Response User: {json.dumps(res.get('user', {}), indent=2)}")
    if status == 200 and res.get("user", {}).get("role") == "doctor":
        print("\nALL SYSTEMS WORKING PERFECTLY! Verification Successful.")
    else:
        print("[Error] Doctor profile mismatch or fetch failed.")

if __name__ == "__main__":
    test_system()
