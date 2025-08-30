import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Raycaster, Vector2 } from 'three';
// physics.js에서 함수들을 가져옵니다.
import { addAttractor, addMovableOrb, clearPhysics, updatePhysics } from './physics.js';

// 3D 시각화를 위한 기본 설정
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const container = document.getElementById('visualization-container');

// 렌더러 크기를 컨테이너에 맞게 설정
renderer.setSize(container.offsetWidth, container.offsetHeight);
container.appendChild(renderer.domElement);

// Low-Poly 스타일을 제거하고, 부드러운 구체를 위해 SphereGeometry 사용
const geometry = new THREE.SphereGeometry(0.5, 32, 32);
const ORB_RADIUS = 0.5; // 구체의 반지름
const MIN_DISTANCE = ORB_RADIUS * 2.5; // 구체 중심 간의 최소 거리 (약간의 여유 공간 포함)

// 빛 설정: 주변광과 점광원을 추가하여 오브젝트가 잘 보이게 합니다.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

camera.position.z = 5;

// OrbitControls 초기화: 마우스로 카메라를 제어할 수 있게 됩니다.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // 부드러운 카메라 움직임
controls.dampingFactor = 0.05;
controls.maxDistance = 20;

// 텍스처 로더: 왜곡에 사용할 텍스처를 불러옵니다.
const textureLoader = new THREE.TextureLoader();
const displacementTexture = textureLoader.load('/static/source/Gemini_wave.png'); 
// 텍스처가 반복되도록 설정합니다.
displacementTexture.wrapS = THREE.RepeatWrapping;
displacementTexture.wrapT = THREE.RepeatWrapping;

// --- Scene 초기화 함수 ---
export function clearScene() {
    // 씬에서 모든 그룹과 어트랙터 메쉬를 제거
    const objectsToRemove = scene.children.filter(child => child.isGroup || child.userData.isAttractor);
    objectsToRemove.forEach(obj => scene.remove(obj));
    // 물리 엔진의 상태도 초기화
    clearPhysics();
}

// --- 감정 Attractor 생성 함수 ---
export function createEmotionAttractor(emotion) {
    const position = addAttractor(emotion, 'emotion');
    if (position) {
        const geometry = new THREE.SphereGeometry(0.6, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        const attractorMesh = new THREE.Mesh(geometry, material);
        attractorMesh.position.copy(position);
        attractorMesh.userData.isAttractor = true;
        scene.add(attractorMesh);
    }
}

// --- 카테고리 Attractor 생성 함수 (새로 추가) ---
export function createCategoryAttractor(category) {
    const position = addAttractor(category, 'category');
    if (position) {
        const geometry = new THREE.SphereGeometry(1.0, 10, 10); // 카테고리 어트랙터를 더 크게
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true });
        const attractorMesh = new THREE.Mesh(geometry, material);
        attractorMesh.position.copy(position);
        attractorMesh.userData.isAttractor = true;
        scene.add(attractorMesh);
    }
}

// 3D 오브젝트(구체)와 파티클을 생성하고 씬에 추가하는 함수
export function createOrb(x, y, z, material, diaryData) {
    // 1. 구체(Orb) 메쉬 생성 (변경 없음)
    const standardMaterial = new THREE.MeshStandardMaterial({
        color: material.color,
        displacementMap: displacementTexture,
        displacementScale: 0.02,
        metalness: 0.3,
        roughness: 0.5
    });
    const orb = new THREE.Mesh(geometry, standardMaterial);

    // 2. 파티클 시스템 생성 (광선 로직 제거)
    const textLength = diaryData.text ? diaryData.text.length : 0;
    const particleCount = Math.max(50, Math.min(500, 50 + textLength));
    
    const particlePositions = [];
    const radius = ORB_RADIUS + 0.5;

    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const pX = Math.cos(angle) * radius;
        const pY = (Math.random() - 0.5) * 0.2;
        const pZ = Math.sin(angle) * radius;
        particlePositions.push(pX, pY, pZ);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));

    const particleColor = new THREE.Color(material.color);
    const hsl = {};
    particleColor.getHSL(hsl);
    particleColor.setHSL((hsl.h + 0.3) % 1.0, hsl.s, hsl.l * 1.2);

    const particleMaterial = new THREE.PointsMaterial({
        color: particleColor,
        size: 0.03,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.userData.isParticleRing = true;

    // 3. 그룹으로 묶기 (광선 객체 제외)
    const group = new THREE.Group();
    group.add(orb);
    group.add(particles);

    group.position.set(x, y, z);
    group.userData.diaryData = diaryData;
    group.userData.emotion = diaryData.emotion;
    group.userData.category = diaryData.category; // 카테고리 정보 추가
    group.userData.velocity = new THREE.Vector3();
    group.userData.isOrbGroup = true;

    scene.add(group);
    addMovableOrb(group);
    
    renderer.render(scene, camera);
    return group;
}

// 겹치지 않는 위치를 생성하는 함수
export function generateNonOverlappingPosition() {
    let position;
    let overlapping;
    const existingOrbs = scene.children.filter(child => child.isMesh && child.userData.diaryData);

    let attempts = 0;
    const maxAttempts = 100; // 무한 루프 방지를 위한 최대 시도 횟수

    do {
        position = new THREE.Vector3(
            (Math.random() - 0.5) * 15, // 생성 범위를 약간 넓힘
            (Math.random() - 0.5) * 15,
            (Math.random() - 0.5) * 15
        );
        
        overlapping = false;
        for (const orb of existingOrbs) {
            if (position.distanceTo(orb.position) < MIN_DISTANCE) {
                overlapping = true;
                break;
            }
        }
        attempts++;
    } while (overlapping && attempts < maxAttempts);

    if (overlapping) {
        console.warn("겹치지 않는 위치를 찾는 데 실패했습니다. 랜덤 위치를 반환합니다.");
    }

    return { x: position.x, y: position.y, z: position.z };
}

// 3D 오브젝트에 대한 마우스 클릭 이벤트 리스너
const raycaster = new Raycaster();
const mouse = new Vector2();
let onOrbClickedCallback = null;

// 클릭된 오브젝트의 데이터를 전달받을 콜백 함수를 설정합니다.
export function setOnOrbClicked(callback) {
    onOrbClickedCallback = callback;
}

renderer.domElement.addEventListener('click', (event) => {
    // 캔버스 내 마우스 위치를 정규화된 좌표로 변환 (-1에서 +1 범위)
    const canvasRect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    mouse.y = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;

    // Raycaster를 업데이트하여 마우스 위치에서 레이를 생성
    raycaster.setFromCamera(mouse, camera);

    // 씬의 모든 자식 오브젝트를 재귀적으로 검사
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let intersectedObject = intersects[0].object;

        // 클릭된 것이 구체 그룹의 일부인지 확인하기 위해 부모를 탐색
        while (intersectedObject && !intersectedObject.userData.isOrbGroup) {
            intersectedObject = intersectedObject.parent;
        }

        // 구체 그룹을 찾았고, 데이터가 있을 경우
        if (intersectedObject && intersectedObject.userData.diaryData) {
            controls.target.copy(intersectedObject.position);

            const data = intersectedObject.userData.diaryData;
            if (onOrbClickedCallback) {
                onOrbClickedCallback(data);
            }
        }
    }
});

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    // 1. 물리 계산
    updatePhysics();

    // 2. 시각 효과
    displacementTexture.offset.x += 0.005;
    scene.children.forEach(child => {
        // 구체와 파티클 회전
        if (child.isGroup && child.userData.isOrbGroup) {
            const orb = child.children[0];
            const particleRing = child.children[1];

            if (orb) orb.rotation.y += 0.002;
            if (particleRing) {
                particleRing.rotation.x += 0.005;
                particleRing.rotation.y += 0.007;
            }
        }
        // 어트랙터 회전
        if (child.userData.isAttractor) {
            child.rotation.x += 0.001;
            child.rotation.y += 0.001;
        }
    });

    controls.update();
    renderer.render(scene, camera);
}

// 윈도우 크기가 변경될 때 렌더러와 카메라를 업데이트
window.addEventListener('resize', () => {
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

// 윈도우 로드 시 애니메이션 시작
function init() {
    animate();
}
init();
