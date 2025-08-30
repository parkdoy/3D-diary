     const form = document.getElementById('login-form');
        const messageBox = document.getElementById('message-box');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                messageBox.classList.remove('hidden');
                if (response.ok) {
                    sessionStorage.setItem('loggedInUserEmail', email);
                    messageBox.textContent = result.message;
                    messageBox.classList.remove('bg-red-500', 'text-red-100');
                    messageBox.classList.add('bg-green-500', 'text-green-100');
                    // 로그인 성공 후 로직 (예: 메인 페이지로 리디렉션)
                    console.log('로그인 성공:', result.user_id);
                    setTimeout(() => {
                        location.href = '/';
                    }, 1000);
                } else {
                    messageBox.textContent = result.message;
                    messageBox.classList.remove('bg-green-500', 'text-green-100');
                    messageBox.classList.add('bg-red-500', 'text-red-100');
                }

            } catch (error) {
                messageBox.classList.remove('hidden');
                messageBox.textContent = '로그인 요청 중 오류 발생.';
                messageBox.classList.remove('bg-green-500', 'text-green-100');
                messageBox.classList.add('bg-red-500', 'text-red-100');
                console.error('로그인 오류:', error);
            }
        });