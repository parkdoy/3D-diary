from flask import request, jsonify
import os
import json
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2 import service_account

# Google Sheets API 서비스 객체를 초기화하는 함수
# 이 함수는 app.py 또는 별도 service 모듈에 정의되어야 합니다.
# 여기서는 예시를 위해 임시로 정의합니다.
def get_sheets_service():
    """
    Google Sheets API 서비스 객체를 반환합니다.
    """
    try:
        # 이 경로는 실제 credentials.json 파일의 경로와 일치해야 합니다.
        creds_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'credentials.json')
        if not os.path.exists(creds_path):
            print(f"ERROR: credentials.json 파일이 존재하지 않습니다: {creds_path}")
            return None

        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        return build('sheets', 'v4', credentials=creds)
    except Exception as e:
        print(f"ERROR: Google Sheets API 서비스 객체 생성 중 오류 발생: {e}")
        return None

# 스프레드시트 ID는 app.py 또는 환경 변수에 정의되어야 합니다.
# 예시 ID를 사용합니다. 실제 스프레드시트 ID로 변경해야 합니다.
DIARY_SPREADSHEET_ID = "1h_mCzTljC2Yj7HqwnGmbCbPTisY1BzHQVet8vPWaXUY"

# 스프레드시트에서 사용자 정보를 검증하는 함수
def validate_user_from_sheet(email, password):
    """
    Google Sheets에서 이메일과 비밀번호를 검증합니다.
    사용자 정보는 'users' 시트에 저장되어 있다고 가정합니다.
    """
    service = get_sheets_service()
    if not service:
        return False, "서버 설정 오류: Google Sheets 서비스에 연결할 수 없습니다."

    try:
        # 'users' 시트의 A:C 범위를 읽습니다. A열: 이메일, B열: 비밀번호, C열: user_id
        result = service.spreadsheets().values().get(
            spreadsheetId=DIARY_SPREADSHEET_ID,
            range='users!A:C'
        ).execute()
        
        values = result.get('values', [])
        
        if not values:
            return False, "사용자 데이터가 스프레드시트에 없습니다."

        # 스프레드시트의 각 행을 순회하며 일치하는 사용자 정보를 찾습니다.
        for row in values:
            # 행에 이메일, 비밀번호, user_id가 모두 있는지 확인
            if len(row) >= 3:
                stored_email, stored_password, user_id = row[0], row[1], row[2]
                
                # 이메일이 일치하는 경우
                if stored_email == email:
                    # 비밀번호도 일치하는 경우 (로그인 성공)
                    if stored_password == password:
                        print(f"디버그: '{email}'로 로그인 성공. user_id: '{user_id}'")
                        return True, "로그인 성공!"
                    # 비밀번호는 일치하지 않는 경우
                    else:
                        print(f"디버그: '{email}'로 로그인 실패 - 비밀번호 불일치.")
                        return False, "로그인 실패: 비밀번호가 올바르지 않습니다."
        
        # 반복문을 모두 돌았는데도 이메일을 찾지 못한 경우
        print(f"디버그: '{email}'에 대한 사용자 정보가 없습니다.")
        return False, "로그인 실패: 존재하지 않는 이메일입니다."

    except HttpError as err:
        print(f"ERROR: Google Sheets API 호출 중 오류 발생: {err}")
        return False, "Google Sheets API 오류가 발생했습니다."
    except Exception as e:
        print(f"ERROR: 사용자 검증 중 예상치 못한 오류 발생: {e}")
        return False, "서버 내부 오류가 발생했습니다."
    
# Flask 앱에 로그인 라우트를 추가하는 함수
def add_login_route(app):
    """
    주어진 Flask 앱에 로그인 라우트를 추가하고, Google Sheets로 검증합니다.
    """
    @app.route('/login', methods=['POST'])
    def login():
        """
        로그인 요청을 처리하고 인증 결과를 반환합니다.
        """
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"status": "error", "message": "이메일과 비밀번호를 모두 입력해주세요."}), 400

        # Google Sheets를 통해 사용자 정보를 검증합니다.
        is_authenticated, message = validate_user_from_sheet(email, password)
        
        if is_authenticated:
            return jsonify({"status": "success", "message": message}), 200
        else:
            return jsonify({"status": "error", "message": message}), 401