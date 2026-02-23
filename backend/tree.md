Active code page: 65001

C:\Users\shiva\OneDrive\Desktop\Edunesta>tree /f
Folder PATH listing for volume Windows
Volume serial number is A4AC-9906
C:.
│   package-lock.json
│   
├───backend
│   │   .env
│   │   .gitignore
│   │   package-lock.json
│   │   package.json
│   │   README.md
│   │   server.js
│   │   test-env.js
│   │
│   ├───config
│   │       db.js
│   │
│   ├───controllers
│   │       adminController.js
│   │       aiController.js
│   │       authController.js
│   │       materialController.js
│   │       questionController.js
│   │       submissionController.js
│   │       testController.js
│   │
│   ├───middleware
│   │       auth.js
│   │       roles.js
│   │       upload.js
│   │
│   ├───models
│   │       Material.js
│   │       Question.js
│   │       Submission.js
│   │       Test.js
│   │       User.js
│   │
│   ├───routes
│   │       admin.js
│   │       ai.js
│   │       auth.js
│   │       listModels.js
│   │       materials.js
│   │       questions.js
│   │       submissions.js
│   │       testGemini.js
│   │       tests.js
│   │
│   ├───uploads
│   │   └───materials
│   │           1765787643460-297475290.pdf
│   │
│   └───utils
│           gemini.js
│           grader.js
│
└───frontend
    │   .env
    │   .gitignore
    │   index.html
    │   package-lock.json
    │   package.json
    │   postcss.config.cjs
    │   README.md
    │   tailwind.config.js
    │   vite.config.js
    │
    └───src
        │   App.jsx
        │   Home.jsx
        │   index.css
        │   main.jsx
        │
        ├───auth
        │       RequireAuth.jsx
        │
        ├───components
        │       Navbar.jsx
        │
        ├───layouts
        │       AdminLayout.jsx
        │       PublicLayout.jsx
        │       StudentLayout.jsx
        │       TeacherLayout.jsx
        │
        ├───pages
        │   ├───admin
        │   │       AdminDashboard.jsx
        │   │       Moderation.jsx
        │   │       Teachers.jsx
        │   │       Users.jsx
        │   │
        │   ├───common
        │   │       Home.jsx
        │   │       Login.jsx
        │   │       Register.jsx
        │   │
        │   ├───student
        │   │       AttemptTest.jsx
        │   │       AvailableTests.jsx
        │   │       Materials.jsx
        │   │       Results.jsx
        │   │       StudentDashboard.jsx
        │   │
        │   └───teacher
        │           CreateTest.jsx
        │           Materials.jsx
        │           Questions.jsx
        │           Submissions.jsx
        │           TeacherDashboard.jsx
        │           Tests.jsx
        │
        ├───services
        │       api.js
        │
        ├───styles
        │       auth.css
        │       public.css
        │
        └───utils
                auth.js
                axios.js
                useAI.js


C:\Users\shiva\OneDrive\Desktop\Edunesta>