async function checkPassword() {

    const password =
        document.getElementById("password").value;

    // Empty Password Check
    if (password.trim() === "") {

        document.getElementById("result").innerHTML = `
            <h3>Please enter a password.</h3>
        `;

        return;
    }

    try {

        const response = await fetch('/check_password', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                password: password
            })
        });

        const data = await response.json();

        // Display Results
        document.getElementById("result").innerHTML = `

            <h2>Score: ${data.score}/100</h2>

            <h2>Strength: ${data.strength}</h2>

            <h3>
                Estimated Crack Time:
                ${data.crack_time}
            </h3>

            <h3>
                Entropy:
                ${data.entropy} bits
            </h3>

            <h3>Security Warnings</h3>

            ${
                data.messages.length > 0

                ?

                `<ul>
                    ${data.messages.map(message =>
                        `<li>${message}</li>`).join('')}
                </ul>`

                :

                `<p>
                    No security warnings detected.
                </p>`
            }

            <h3>AI Suggestions</h3>

            ${
                data.suggestions.length > 0

                ?

                `<ul>
                    ${data.suggestions.map(suggestion =>
                        `<li>${suggestion}</li>`).join('')}
                </ul>`

                :

                `<p>
                    Excellent password.
                    No additional suggestions needed.
                </p>`
            }
        `;

        // Strength Bar
        const bar =
            document.getElementById("strength-bar");

        bar.style.width = data.score + "%";

        // Change Bar Color
        if (data.score < 40) {

            bar.style.background = "red";
        }

        else if (data.score < 70) {

            bar.style.background = "orange";
        }

        else {

            bar.style.background = "green";
        }

    }

    catch (error) {

        console.error(error);

        document.getElementById("result").innerHTML = `

            <h3>Something went wrong.</h3>

        `;
    }
}


// Show / Hide Password
function togglePassword(){

    const passwordField =
        document.getElementById("password");

    const toggleButton =
        document.querySelector(".password-box button");

    if(passwordField.type === "password"){

        passwordField.type = "text";

        toggleButton.innerText = "Hide";
    }

    else{

        passwordField.type = "password";

        toggleButton.innerText = "Show";
    }
}


// Generate Strong Password
function generatePassword(){

    const upper =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const lower =
        "abcdefghijklmnopqrstuvwxyz";

    const numbers =
        "0123456789";

    const symbols =
        "!@#$%^&*";

    const allChars =
        upper + lower + numbers + symbols;

    let password = "";

    // Ensure all character types exist
    password += upper[
        Math.floor(Math.random() * upper.length)
    ];

    password += lower[
        Math.floor(Math.random() * lower.length)
    ];

    password += numbers[
        Math.floor(Math.random() * numbers.length)
    ];

    password += symbols[
        Math.floor(Math.random() * symbols.length)
    ];

    // Add remaining random characters
    for(let i = 0; i < 8; i++){

        password += allChars[
            Math.floor(Math.random() * allChars.length)
        ];
    }

    // Shuffle password
    password = password
        .split('')
        .sort(() => 0.5 - Math.random())
        .join('');

    // Put password into input field
    document.getElementById("password").value =
        password;
}