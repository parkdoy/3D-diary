// core/three-scene.js 파일에서 필요한 함수들을 가져옵니다.
import { createOrb, setOnOrbClicked, generateNonOverlappingPosition, createEmotionAttractor, clearScene } from './core/three-scene.js';
import * as THREE from 'three';

// DOM 요소들을 가져옵니다.
const recordButton = document.getElementById('record-button');
const diaryEntry = document.getElementById('diary-entry');
const resultEmotion = document.getElementById('result-emotion');
const resultCategory = document.getElementById('result-category');
const toggleButton = document.getElementById('toggle-button');
const sidebar = document.getElementById('input-sidebar');

// 메시지 표시 함수: 오류나 성공 메시지를 사용자에게 보여줍니다.
function showMessage(message, isError = false) {
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');
    if (isError) {
        messageBox.classList.add('error');
    }
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    setTimeout(() => {
        messageBox.style.opacity = '0';
        messageBox.style.transform = 'translate(-50%, -50%) scale(0.9)';
        messageBox.addEventListener('transitionend', () => {
            messageBox.remove();
        });
    }, 3000);
}

// 감정별 오브젝트 재질(색상)을 정의하는 딕셔너리
const emotionMaterials = {
    '기쁨': new THREE.MeshLambertMaterial({ color: 0xFFD700 }), // 골드
    '슬픔': new THREE.MeshLambertMaterial({ color: 0x1E90FF }), // 파란색
    '불안': new THREE.MeshLambertMaterial({ color: 0x8A2BE2 }), // 보라색
    '당황': new THREE.MeshLambertMaterial({ color: 0xFF4500 }), // 주황색
    '분노': new THREE.MeshLambertMaterial({ color: 0xFF0000 }), // 빨간색
    '상처': new THREE.MeshLambertMaterial({ color: 0x808080 }), // 회색
    '놀람': new THREE.MeshLambertMaterial({ color: 0x32CD32 }), // 초록색
    '중립': new THREE.MeshLambertMaterial({ color: 0xD3D3D3 }), // 밝은 회색
    '분류불가': new THREE.MeshLambertMaterial({ color: 0x000000 }) // 검은색
};

// 사이드바 토글 버튼 클릭 이벤트
toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('visible');
    toggleButton.classList.toggle('is-open');
    if (toggleButton.classList.contains('is-open')) {
        toggleButton.textContent = '<';
    } else {
        toggleButton.textContent = '>';
    }
});

// 페이지 로드 시 사용자 인증 상태 확인
document.addEventListener('DOMContentLoaded', () => {
    // sessionStorage에서 사용자 이메일 가져오기
    const userEmail = sessionStorage.getItem('loggedInUserEmail');
    const userEmailDisplay = document.getElementById('user-email-display');

    if (userEmail) {
        userEmailDisplay.textContent = `환영합니다, ${userEmail}님!`;
        console.log('디버그: sessionStorage에서 사용자 이메일 확인:', userEmail);
        // 페이지 로드 시 모든 기록을 불러옵니다.
        loadAllRecords(userEmail);
    } else {
        // 이메일이 없으면 로그인 페이지로 리디렉션
        window.location.href = '/login';
    }
});

// 모든 기록을 불러와 3D 공간에 표시하는 함수
async function loadAllRecords(userEmail) {
    if (!userEmail) {
        console.error('사용자 이메일이 없어 기록을 불러올 수 없습니다.');
        return;
    }

    console.log(`'${userEmail}'님의 모든 기록을 불러옵니다...`);
    showMessage('은하계에서 당신의 기록을 찾는 중...');

    try {
        const response = await fetch(`/get_all_records?user_email=${encodeURIComponent(userEmail)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '기록을 불러오는 데 실패했습니다.');
        }

        const data = await response.json();
        if (data.status === 'success') {
            // 새로 불러오기 전, 이전의 구체와 Attractor를 모두 제거합니다.
            clearScene();

            // 1. 고유한 감정 목록을 기반으로 Attractor를 먼저 생성합니다.
            const emotions = [...new Set(data.records.map(record => record.emotion))];
            emotions.forEach(emotion => {
                createEmotionAttractor(emotion);
            });

            // 2. 각 기록에 대한 구체를 생성합니다.
            console.log(`총 ${data.records.length}개의 기록을 불러왔습니다.`);
            data.records.forEach(record => {
                const material = emotionMaterials[record.emotion] || emotionMaterials['분류불가'];
                const position = generateNonOverlappingPosition();
                // createOrb에 record 전체를 넘겨서 emotion 정보를 활용하도록 합니다.
                createOrb(position.x, position.y, position.z, material, record);
            });
            showMessage('모든 기록을 성공적으로 불러왔습니다!');
        } 
    } catch (error) {
        console.error('기록 로딩 중 오류 발생:', error);
        showMessage(`기록 로딩 실패: ${error.message}`, true);
    }
}

// 기록하기 버튼 클릭 이벤트
recordButton.addEventListener('click', async () => {
    const diaryText = diaryEntry.value;
    const userEmail = sessionStorage.getItem('loggedInUserEmail');
   // 디버깅을 위한 로그 추가: 어떤 데이터가 서버로 전송되는지 확인합니다.
    console.log('디버그: 기록 버튼 클릭됨');
    console.log('디버그: 일기 내용:', diaryText);
    console.log('디버그: 사용자 이메일:', userEmail);

    // 이메일 또는 일기 내용이 없으면 경고 메시지 표시
    if (!userEmail) {
        showMessage('로그인이 필요합니다. 로그인 페이지로 이동합니다.', true);
        setTimeout(() => {
            window.location.href = 'login';
        }, 1500);
        return;
    }

    if (diaryText.trim() === "") {
        showMessage('일기 내용을 입력해주세요.', true);
        return;
    }

    // 로딩 메시지 표시
    showMessage('기록을 분석하고 은하계에 보내는 중...');
    
    // 겹치지 않는 새로운 구체 위치 생성
    const position = generateNonOverlappingPosition();

    try {
        const response = await fetch('/analyze_diary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ diary_entry: diaryText, user_email: userEmail, position: position })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '서버 오류가 발생했습니다.');
        }

        const data = await response.json();
        
        // 분석 결과 표시
        resultEmotion.textContent = data.emotion;
        resultCategory.textContent = data.category;
        
        // 감정에 맞는 재질 선택
        const material = emotionMaterials[data.emotion] || emotionMaterials['분류불가'];
        
        // 3D 오브젝트 생성 (서버에서 받은 위치 사용)
        createOrb(data.position.x, data.position.y, data.position.z, material, data);

        // 성공 메시지 표시
        showMessage('기록이 성공적으로 은하계에 도착했습니다!');
    } catch (error) {
        console.error('API 호출 중 오류 발생:', error);
        showMessage('전송 실패: 서버 연결을 확인하세요.', true);
    }
});

// 오브젝트 클릭 시 사이드바에 데이터 표시
setOnOrbClicked((data) => {
    const detailEmotion = document.getElementById('detail-emotion');
    const detailCategory = document.getElementById('detail-category');
    const detailText = document.getElementById('detail-text');
    const detailTimestamp = document.getElementById('detail-timestamp');

    detailEmotion.textContent = data.emotion;
    detailCategory.textContent = data.category;
    detailText.textContent = data.text;
    detailTimestamp.textContent = data.timestamp;

    sidebar.classList.add('visible');
    toggleButton.classList.add('is-open');
    toggleButton.textContent = '<';
});