       const form = document.getElementById('register-form');
        const messageBox = document.getElementById('message-box');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                messageBox.classList.remove('hidden');
                if (response.ok) {
                    messageBox.textContent = result.message;
                    messageBox.classList.remove('bg-red-500', 'text-red-100');
                    messageBox.classList.add('bg-green-500', 'text-green-100');
                    // 등록 성공 후 로직 (예: 로그인 페이지로 리디렉션)
                    setTimeout(() => {
                        window.location.href = 'login';
                    }, 2000); // 2초 후 로그인 페이지로 이동
                } else {
                    messageBox.textContent = result.message;
                    messageBox.classList.remove('bg-green-500', 'text-green-100');
                    messageBox.classList.add('bg-red-500', 'text-red-100');
                }

            } catch (error) {
                messageBox.classList.remove('hidden');
                messageBox.textContent = '등록 요청 중 오류 발생.';
                messageBox.classList.remove('bg-green-500', 'text-green-100');
                messageBox.classList.add('bg-red-500', 'text-red-100');
                console.error('등록 오류:', error);
            }
        });