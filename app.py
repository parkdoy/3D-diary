import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from services.sheets import save_to_sheet, get_sheets_service, get_records_from_sheet
from services.analyzer import analyze_text, load_models
from flask import Flask, render_template
from services.login import add_login_route 
from services.register import add_register_route
from config import DIARY_SPREADSHEET_ID

# 현재 스크립트 파일의 절대 경로를 가져와 기본 디렉터리로 설정합니다.
base_dir = os.path.dirname(os.path.abspath(__file__))
# Flask 앱을 초기화할 때, template_folder와 static_folder를 절대 경로로 설정합니다.
app = Flask(__name__, static_folder=os.path.join(base_dir, 'static'), template_folder=os.path.join(base_dir, 'templates'))

# 로그인 라우트 추가
add_login_route(app)
#회원가입 라우트 추가
add_register_route(app)
CORS(app)

# 서버가 시작될 때 AI 모델을 미리 로드합니다.
# 이렇게 하면 모델을 한 번만 로드하고 애플리케이션 전체에서 사용할 수 있습니다.
emotion_classifier, summarizer = load_models()
if emotion_classifier is None or summarizer is None:
    print("경고: AI 모델 로드에 실패했습니다. 분석 기능이 올바르게 작동하지 않을 수 있습니다.")

# 스프레드시트 ID는 app.py 또는 환경 변수에 정의되어야 합니다.
SPREADSHEET_ID = DIARY_SPREADSHEET_ID

# Google Sheets에서 사용자의 user_id를 조회하는 함수
def get_user_id_from_sheet(email):
    """
    주어진 이메일에 해당하는 user_id를 Google Sheets에서 조회합니다.
    """
    service = get_sheets_service()
    if not service:
        return None

    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='users!A:C' # Assuming email is in column A and user_id is in column C
        ).execute()
        values = result.get('values', [])
        
        if not values:
            return None

        # Find the row with the matching email and return the corresponding user_id
        for row in values:
            if len(row) > 2 and row[0] == email:
                return row[2] # user_id is in the third column (index 2)
        
    except Exception as e:
        print(f"ERROR: Failed to retrieve user ID from sheet: {e}")
        return None
    return None

# 메인 페이지 라우트
@app.route('/')
def home():
    """index.html 메인 페이지를 렌더링합니다."""
    return render_template('index.html')

# 로그인 페이지를 렌더링하는 라우트
@app.route('/login')
def login_page():
    """
    로그인 페이지(login.html)를 렌더링합니다.
    """
    return render_template('login.html')

# 회원가입 페이지를 렌더링하는 라우트
@app.route('/register')
def show_register_page():
    """register.html 페이지를 렌더링합니다."""
    return render_template('register.html')

# 사용자의 모든 기록을 불러오는 라우트
@app.route('/get_all_records', methods=['GET'])
def get_all_records():
    """
    사용자의 모든 일기 기록을 Google Sheets에서 불러와 클라이언트에 반환합니다.
    """
    user_email = request.args.get('user_email')
    if not user_email:
        return jsonify({"status": "error", "message": "사용자 이메일이 필요합니다."}), 400

    user_id = get_user_id_from_sheet(user_email)
    if not user_id:
        return jsonify({"status": "error", "message": "사용자를 찾을 수 없습니다."}), 404

    # sheets.py의 함수를 호출하여 모든 기록을 가져옵니다.
    result, status_code = get_records_from_sheet(user_id, SPREADSHEET_ID)
    
    return jsonify(result), status_code

# 일기 분석 및 처리 라우트
@app.route('/analyze_diary', methods=['POST'])
def analyze_diary():
    """클라이언트로부터 일기 텍스트를 받아 감정/카테고리 분석 후 Google Sheets에 저장합니다."""
    if emotion_classifier is None or summarizer is None:
        return jsonify({"status": "error", "message": "서버 오류: AI 모델이 로드되지 않았습니다."}), 500

    data = request.json
    diary_text = data.get('diary_entry', '')
    user_email = data.get('user_email', '')
    position = data.get('position') # position 데이터 가져오기
    print(f"디버그: 클라이언트로부터 받은 일기 텍스트: '{diary_text}' 사용자: {user_email}")

    if not diary_text.strip():
        return jsonify({"status": "error", "message": "일기 내용이 비어 있습니다."}), 400
    
    if not user_email.strip():
        return jsonify({"status": "error", "message": "사용자 이메일이 비어 있습니다."}), 400

    if not position:
        return jsonify({"status": "error", "message": "위치 데이터가 없습니다."}), 400

    try:
        # Google Sheets에서 사용자 ID를 조회합니다.
        user_id = get_user_id_from_sheet(user_email)
        if not user_id:
            return jsonify({"status": "error", "message": "User not found."}), 404

        # analyzer.py 파일의 분석 함수를 호출합니다.
        analysis_result = analyze_text(diary_text, emotion_classifier, summarizer)
        predicted_emotion = analysis_result['emotion']
        predicted_emotion_label = analysis_result['emotion_label']
        predicted_category = analysis_result['category']
        timestamp = analysis_result['timestamp']

        # sheets.py 파일의 데이터 저장 함수를 호출합니다. (position 인자 추가)
        save_result = save_to_sheet(diary_text, predicted_emotion, predicted_category, timestamp, user_id, SPREADSHEET_ID, position)
        if save_result["status"] == "error":
            return jsonify(save_result), 500

        # 최종 응답 데이터를 구성하여 클라이언트로 전송합니다.
        response_data = {
            "status": "success",
            "emotion": predicted_emotion,
            "emotion_label": predicted_emotion_label, 
            "category": predicted_category,
            "timestamp": timestamp,
            "text": diary_text,
            "position": position # 응답에 position 추가
        }
        return jsonify(response_data)

    except Exception as e:
        print(f"처리 중 오류가 발생했습니다: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Flask의 `app.run` 함수를 사용합니다.
    app.run(debug=True)