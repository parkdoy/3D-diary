import torch
from transformers import pipeline
import re
from datetime import datetime

# 허깅페이스 모델을 로드하고 한국어 감정을 매핑합니다.
def load_models():
    """
    감정 분류 및 요약 AI 모델을 로드합니다.
    로드된 모델들을 반환합니다.
    """
    emotion_classifier = None
    summarizer = None
    try:
        # 'Jinuuuu/KoELECTRA_fine_tunning_emotion' 모델을 로드합니다.
        emotion_model_name = "Jinuuuu/KoELECTRA_fine_tunning_emotion"
        emotion_classifier = pipeline("text-classification", model=emotion_model_name, device=0 if torch.cuda.is_available() else -1)
        # 한국어 요약에 특화된 모델을 로드합니다.
        # 'gogamza/kobart-summarization' 모델을 사용합니다.
        summarizer_model_name = "gogamza/kobart-summarization"
        summarizer = pipeline("summarization", model=summarizer_model_name, device=0 if torch.cuda.is_available() else -1)
        print("디버그: 텍스트 분류 및 요약 모델이 성공적으로 로드되었습니다.")
    except ImportError as e:
        print(f"디버그: ImportError로 인해 모델 로드에 실패했습니다: {e}")
    except Exception as e:
        print(f"디버그: 예상치 못한 오류로 인해 모델 로드에 실패했습니다: {e}")
    return emotion_classifier, summarizer

# 모델의 감정 레이블을 한국어로 매핑하기 위한 딕셔너리
emotion_map = {
    'happy': '기쁨',
    'sad': '슬픔',
    'anxious': '불안',
    'embarrassed': '당황',
    'angry': '분노',
    'heartache': '상처',
    'surprise': '놀람',
    'neutral': '중립',
}

# 일기 텍스트에 특정 키워드가 포함되어 있는지 확인하여 카테고리를 분류합니다.
category_keywords = {
    '업무': ['회사', '업무', '프로젝트', '야근', '회의'],
    '학업': ['공부', '과제', '시험', '학교', '강의', '지식', '습득'],
    '관계': ['친구', '가족', '연인', '만남', '대화'],
    '건강': ['운동', '다이어트', '병원', '건강', '피곤'],
    '여행': ['여행', '휴가', '비행기', '해외', '숙소'],
    '일상': ['일상', '하루', '오늘', '점심', '저녁'],
    '음식': ['음식', '요리', '맛집', '먹방', '카페']
}

def analyze_text(diary_text, emotion_classifier, summarizer):
    """
    주어진 일기 텍스트에 대해 감정 및 카테고리 분석을 수행합니다.
    분석 결과를 담은 딕셔너리를 반환합니다.
    """
    try:
        # 감정 분석을 수행합니다.
        emotion_result = emotion_classifier(diary_text)[0]
        predicted_emotion_label = emotion_result['label']
        predicted_emotion = emotion_map.get(predicted_emotion_label, '분류불가')
        print(f"디버그: 감정 분석 결과 - 레이블: {predicted_emotion_label}, 예측 감정: {predicted_emotion}")

        # 2. 카테고리 분석을 수행합니다.
        predicted_category = "기타"  # 기본값 설정.
        # 2-1. 해시태그로 카테고리 분류.
        hashtags = re.findall(r'#(\w+)', diary_text)
        if hashtags:
            predicted_category = hashtags[0]
            print(f"디버그: 해시태그 '#{predicted_category}' 발견. 카테고리 지정.")
        else:
            # 2-2. 키워드를 기반으로 카테고리 분류.
            found_category = None
            for category, keywords in category_keywords.items():
                for keyword in keywords:
                    if keyword in diary_text:
                        found_category = category
                        break
                if found_category:
                    break
            if found_category:
                predicted_category = found_category
                print(f"디버그: 키워드 '{keyword}' 발견. 카테고리: {predicted_category}.")
            else:
                # 2-3. 키워드도 없으면 요약 모델로 카테고리 지정.
                if summarizer:
                    summary_result = summarizer(diary_text)[0]
                    predicted_category = summary_result['summary_text']
                    print(f"디버그: 해시태그나 키워드 없음 {summary_result}. 요약 모델로 카테고리 지정: '{predicted_category}'")
                    predicted_category = "기타"
                    print("디버그: 해시태그나 키워드 없음. '기타' 카테고리로 지정.")
        
        # 현재 시간을 'yyyy-mm-dd-HH:MM' 형식으로 포맷합니다.
        current_timestamp = datetime.now().strftime('%Y-%m-%d-%H:%M')

        return {
            "emotion": predicted_emotion,
            "emotion_label": predicted_emotion_label,
            "category": predicted_category,
            "timestamp": current_timestamp
        }
    
    except Exception as e:
        print(f"디버그: 분석 중 오류가 발생했습니다: {e}")
        raise e