import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# 현재 스크립트 파일의 절대 경로를 가져옵니다.
base_dir = os.path.dirname(os.path.abspath(__file__))

# Google Sheets API 서비스 객체를 초기화하는 함수
def get_sheets_service():
    """Google Sheets API 서비스 객체를 반환합니다."""
    try:
        # 'credentials.json' 파일의 경로를 설정합니다. (상위 폴더에 위치)
        creds_path = os.path.join(base_dir, '../credentials.json')
        if not os.path.exists(creds_path):
            raise FileNotFoundError("credentials.json 파일이 존재하지 않습니다. 프로젝트 최상위 폴더에 넣어주세요.")

        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        print(f"Google Sheets API 서비스 초기화 오류: {e}")
        return None

# Google Sheets에 데이터를 저장하는 함수
def save_to_sheet(diary_text, emotion, category, timestamp, user_id, spreadsheet_id, position):
    """일기 데이터를 Google Sheets에 저장합니다.
        Args:
        diary_text (str): 일기 내용.
        emotion (str): 감정 분석 결과.
        category (str): 카테고리 분석 결과.
        timestamp (str): 기록 시간.
        user_id (str): 사용자의 고유 ID. 이 값이 시트 이름이 됩니다.
        spreadsheet_id (str): Google Spreadsheet ID.
        position (dict): {'x': float, 'y': float, 'z': float} 형태의 위치 데이터.
    """

    service = get_sheets_service()
    if not service:
        return {"status": "error", "message": "Google Sheets API 서비스 객체를 가져올 수 없습니다. credentials.json 파일과 권한을 확인해주세요."}

    # 시트 이름과 범위를 동적으로 설정합니다. (A:G로 확장)
    RANGE_NAME = f'{user_id}!A:G'


    try:
        # 스프레드시트에 추가할 데이터 (위치 정보 포함)
        values = [[timestamp, emotion, category, diary_text, position['x'], position['y'], position['z']]]
        body = {'values': values}

        # 스프레드시트의 마지막 행에 데이터를 추가합니다.
        result = service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=RANGE_NAME,
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()

        print(f"디버그: {result.get('updates').get('updatedCells')}개의 셀이 추가되었습니다.")
        return {"status": "success", "message": "일기가 Google Sheets에 성공적으로 저장되었습니다."}

    except HttpError as err:
        print(f"Google Sheets API 오류가 발생했습니다: {err}")
        return {"status": "error", "message": f"Google Sheets API 오류: {err}"}
    except Exception as e:
        print(f"데이터 저장 중 예상치 못한 오류가 발생했습니다: {e}")
        return {"status": "error", "message": f"데이터 저장 중 예상치 못한 오류: {e}"}
    
def get_records_from_sheet(user_id, spreadsheet_id):
    """
    사용자의 ID에 해당하는 시트에서 모든 일기 기록을 불러옵니다.
    """
    service = get_sheets_service()
    if not service:
        return {"status": "error", "message": "Google Sheets API 서비스에 연결할 수 없습니다."}, 500

    try:
        # 사용자 ID를 시트 이름으로 사용하여 범위를 설정합니다. (A:G로 확장)
        RANGE_NAME = f'{user_id}!A:G'
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=RANGE_NAME
        ).execute()
        
        values = result.get('values', [])
        
        records = []
        if values:
            # 헤더 행이 있는지 확인하고 건너뜁니다.
            start_index = 1 if values and values[0] == ["Timestamp", "Emotion", "Category", "Diary Text", "x", "y", "z"] else 0
            for row in values[start_index:]:
                if len(row) >= 7:
                    record = {
                        "timestamp": row[0],
                        "emotion": row[1],
                        "category": row[2],
                        "text": row[3],
                        "position": {
                            "x": float(row[4]),
                            "y": float(row[5]),
                            "z": float(row[6])
                        }
                    }
                    records.append(record)
        
        print(f"디버그: 사용자 '{user_id}'의 기록 {len(records)}개를 성공적으로 불러왔습니다.")
        return {"status": "success", "records": records}, 200

    except HttpError as err:
        # 시트를 찾을 수 없는 경우 (오류 코드 400 Bad Request, 'Unable to parse range')
        if err.resp.status == 400 and 'Unable to parse range' in str(err.content):
            print(f"디버그: 사용자 '{user_id}'에 대한 시트가 존재하지 않습니다. 새 사용자일 수 있습니다.")
            return {"status": "success", "records": []}, 200
        print(f"ERROR: Google Sheets API 호출 중 오류 발생: {err}")
        return {"status": "error", "message": "Google Sheets API 오류가 발생했습니다."}, 500
    except Exception as e:
        print(f"ERROR: 데이터 불러오기 중 예상치 못한 오류 발생: {e}")
        return {"status": "error", "message": "서버 내부 오류가 발생했습니다."}, 500

def get_user_sheet_id(user_id, spreadsheet_id):
    """
    주어진 user_id와 일치하는 시트의 ID를 찾아 반환합니다.
    user_id는 시트의 이름과 동일하다고 가정합니다.
    Args:
        user_id (str): 사용자의 고유 ID.
        spreadsheet_id (str): Google 스프레드시트 ID.
    Returns:
        int: 일치하는 시트의 ID (정수). 찾지 못하면 None.
    """
    service = get_sheets_service()
    if not service:
        print("ERROR: Google Sheets 서비스에 연결할 수 없습니다.")
        return None

    try:
        # 스프레드시트의 모든 시트 메타데이터를 가져옵니다.
        # fields='sheets.properties'를 사용하여 필요한 정보만 요청합니다.
        result = service.spreadsheets().get(
            spreadsheetId=spreadsheet_id,
            fields='sheets.properties'
        ).execute()

        sheets = result.get('sheets', [])
        for sheet in sheets:
            sheet_properties = sheet.get('properties', {})
            sheet_title = sheet_properties.get('title')
            sheet_id = sheet_properties.get('sheetId')
            
            # 시트 이름이 user_id와 일치하는지 확인합니다.
            if sheet_title == user_id:
                print(f"디버그: '{user_id}'에 해당하는 시트를 찾았습니다. 시트 ID: {sheet_id}")
                return sheet_id
        
        # 일치하는 시트를 찾지 못한 경우
        print(f"디버그: '{user_id}'에 해당하는 시트를 찾을 수 없습니다.")
        return None

    except HttpError as err:
        print(f"ERROR: Google Sheets API 호출 중 오류 발생: {err}")
        return None
    except Exception as e:
        print(f"ERROR: 시트 ID 조회 중 예상치 못한 오류 발생: {e}")
        return None