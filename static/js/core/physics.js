import * as THREE from 'three';

// 물리 상수 정의 (파라미터화된 상태 유지)
export const physicsParams = {
    G_FORCE_EMOTION: 0.002,
    G_FORCE_CATEGORY: 0.001,
    O_FORCE: 0.08,
    R_FORCE: 0.1,
    MAX_SPEED: 0.5,
    DAMPING: 0.98,
};

const MIN_DISTANCE = 0.5 * 2.5; // 반발력 계산 최소 거리

// 모듈의 상태를 저장하는 변수
let attractors = {};
let movableOrbs = [];

export function clearPhysics() {
    attractors = {};
    movableOrbs = [];
}

export function addAttractor(name, type) {
    const key = `${type}_${name}`;
    if (!attractors[key]) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        attractors[key] = { position, type, name };
        console.log(`Attractor added: ${name} (type: ${type}) at`, position);
        return position;
    }
    return attractors[key].position;
}

export function addMovableOrb(group) {
    // userData에 velocity가 없으면 초기화
    if (!group.userData.velocity) {
        group.userData.velocity = new THREE.Vector3();
    }
    // movableOrbs 배열에 직접 group을 추가
    movableOrbs.push(group);
}


/**
 * 매 프레임 호출될 물리 계산 함수.
 */
export function updatePhysics() {
    if (movableOrbs.length === 0) return;

    // 1. 각 구체에 작용하는 힘을 계산
    movableOrbs.forEach(orb => {
        const orbPosition = orb.position;
        let totalForce = new THREE.Vector3();

        // 감정 어트랙터에 대한 궤도 및 중력 (주된 힘)
        const emotionAttractor = attractors[`emotion_${orb.userData.emotion}`];
        if (emotionAttractor) {
            const dirToEmotion = new THREE.Vector3().subVectors(emotionAttractor.position, orbPosition);
            const distToEmotion = dirToEmotion.length();
            dirToEmotion.normalize();

            // 1a. 중력 (감정) - 수정
            const gravityForceEmotion = dirToEmotion.clone().multiplyScalar(physicsParams.G_FORCE_EMOTION);
            totalForce.add(gravityForceEmotion);

            // 1b. 궤도 힘 (감정) - 수정
            const orbitalForce = new THREE.Vector3(-dirToEmotion.z, dirToEmotion.y, dirToEmotion.x);
            orbitalForce.multiplyScalar(physicsParams.O_FORCE / Math.max(1, distToEmotion));
            totalForce.add(orbitalForce);
        }

        // 카테고리 어트랙터에 대한 중력 (보조 힘)
        const categoryAttractor = attractors[`category_${orb.userData.category}`];
        if (categoryAttractor) {
            const dirToCategory = new THREE.Vector3().subVectors(categoryAttractor.position, orbPosition);
            const distToCategory = dirToCategory.length();
            dirToCategory.normalize();
            
            // 1c. 중력 (카테고리) - 수정
            const gravityForceCategory = dirToCategory.clone().multiplyScalar(physicsParams.G_FORCE_CATEGORY);
            totalForce.add(gravityForceCategory);

            // 1d. 궤도 힘 (카테고리) 추가 - 수정
            const orbitalForceCategory = new THREE.Vector3(-dirToCategory.z, dirToCategory.y, dirToCategory.x);
            orbitalForceCategory.multiplyScalar(physicsParams.O_FORCE / Math.max(1, distToCategory));
            totalForce.add(orbitalForceCategory);
        }

        // 다른 구체와의 반발력
        let repulsionForce = new THREE.Vector3();
        movableOrbs.forEach(otherOrb => {
            if (orb === otherOrb) return;

            const dir = new THREE.Vector3().subVectors(orbPosition, otherOrb.position);
            const distance = dir.length();

            if (distance < MIN_DISTANCE) {
                // 수정
                const force = dir.normalize().multiplyScalar(physicsParams.R_FORCE / (distance * distance + 0.1));
                repulsionForce.add(force);
            }
        });
        totalForce.add(repulsionForce);

        // 계산된 힘을 임시로 저장
        orb.userData.force = totalForce;
    });

    // 2. 모든 힘 계산이 끝난 후 속도와 위치를 업데이트
    movableOrbs.forEach(orb => {
        // 속도 업데이트
        orb.userData.velocity.add(orb.userData.force);

        // 속도 감쇠 - 수정
        orb.userData.velocity.multiplyScalar(physicsParams.DAMPING);

        // 최대 속도 제한 - 수정
        if (orb.userData.velocity.length() > physicsParams.MAX_SPEED) {
            orb.userData.velocity.normalize().multiplyScalar(physicsParams.MAX_SPEED);
        }

        // 위치 업데이트
        orb.position.add(orb.userData.velocity);
    });
}