import uuid
from flask import request, jsonify
from googleapiclient.errors import HttpError
from services.sheets import get_sheets_service
from config import DIARY_SPREADSHEET_ID
    

def create_new_user(email, password):
    """
    새로운 사용자를 등록하고 고유한 user_id를 자동으로 생성하여 Google Sheets에 저장합니다.
    """
    service = get_sheets_service()
    if not service:
        return False, "서버 설정 오류: Google Sheets 서비스에 연결할 수 없습니다."

    try:
        # 고유한 사용자 ID를 생성합니다.
        user_id = str(uuid.uuid4())
        print(f"디버그: 새로운 사용자 ID 생성 - {user_id}")

        # 1. 'users' 시트에 사용자 정보 추가
        # A열: email, B열: password, C열: user_id 순서
        values_to_add = [[email, password, user_id]]

        service.spreadsheets().values().append(
            spreadsheetId=DIARY_SPREADSHEET_ID,
            range='users!A1',
            valueInputOption='USER_ENTERED',
            body={'values': values_to_add}
        ).execute()

        # 2. 새로운 사용자 ID로 일기 시트 생성
        # sheets.batchUpdate를 사용하여 새 시트를 생성합니다.
        requests = [{
            'addSheet': {
                'properties': {
                    'title': user_id  # 시트 이름을 사용자 ID로 설정
                }
            }
        }]
        body = { 'requests': requests }
        service.spreadsheets().batchUpdate(
            spreadsheetId=DIARY_SPREADSHEET_ID,
            body=body
        ).execute()

        # 3. 새로 생성된 시트에 헤더(테이블 행) 추가
        header_row = [['Timestamp', 'Emotion', 'Category', 'Text']]
        service.spreadsheets().values().append(
            spreadsheetId=DIARY_SPREADSHEET_ID,
            range=f'{user_id}!A1', # 새로 생성된 시트의 A1 셀부터 시작
            valueInputOption='USER_ENTERED',
            body={'values': header_row}
        ).execute()
        
        print(f"디버그: 새로운 사용자 '{email}'가 스프레드시트에 추가되었고, 일기 시트 '{user_id}'가 생성되었습니다.")
        return True, "사용자 등록 성공!"

    except HttpError as err:
        print(f"ERROR: Google Sheets API 호출 중 오류 발생: {err}")
        return False, "Google Sheets API 오류가 발생했습니다."
    except Exception as e:
        print(f"ERROR: 사용자 등록 중 예상치 못한 오류 발생: {e}")
        return False, "서버 내부 오류가 발생했습니다."

def add_register_route(app):
    """
    주어진 Flask 앱에 회원가입 라우트를 추가합니다.
    """
    @app.route('/register', methods=['POST'])
    def register():
        """
        회원가입 요청을 처리하고 사용자 등록 결과를 반환합니다.
        """
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"status": "error", "message": "이메일과 비밀번호를 모두 입력해주세요."}), 400

        success, message = create_new_user(email, password)
        
        if success:
            return jsonify({"status": "success", "message": message}), 201
        else:
            return jsonify({"status": "error", "message": message}), 500