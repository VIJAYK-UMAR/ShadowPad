# 🔐 ShadowPad

### Your thoughts. Your documents. Your privacy.

ShadowPad is a privacy-focused online text editor that helps users create, store, and access their important personal information from different devices.

🌐 **Live Demo:** https://shadowpad.netlify.app/

💻 **GitHub Repository:** https://github.com/VIJAYK-UMAR/ShadowPad

---

## 💡 About the Project

The idea behind ShadowPad started with a simple real-life question:

"What if I needed some important information but didn't have my phone with me?"

This made me think about creating a place where people could store important information and access it whenever they need it, using an available device with an internet connection.

That thought inspired me to build ShadowPad.

It is designed as a general-purpose private workspace for storing personal notes, reminders, and other important information.

## ✨ Features

- **Individual Document Passwords:** Protect each document with its own password.
- **Client-Side Encryption:** Document content is encrypted in the browser using AES-256-GCM.
- **Recovery Keys:** Recover access to documents using their recovery keys.
- **User Authentication:** Account registration, login, and password reset.
- **Rich Text Editor:** Format documents using bold, italic, underline, headings, and lists.
- **Automatic Saving:** Save document changes automatically.
- **Cloud Storage:** Store encrypted document data using Supabase.
- **Access Across Devices:** Access your documents from supported devices with an internet connection and the required credentials.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Vite | Development and build tool |
| JavaScript | Application logic |
| Supabase Auth | User authentication |
| PostgreSQL | Database |
| Web Crypto API | Client-side encryption |
| AES-256-GCM | Document encryption |
| PBKDF2 | Password-based key derivation |
| HKDF | Recovery key-based key derivation |
| TipTap | Rich text editor |
| Netlify | Frontend deployment |

## 🔒 Security Approach

ShadowPad uses client-side encryption to protect document content.

- Documents are encrypted in the browser before being stored.
- Each document has its own encryption key.
- Password-derived keys protect access to document encryption keys.
- Recovery keys provide an alternative way to recover document access.
- Supabase Row Level Security (RLS) restricts database access to document owners.

**Important security notes:**
- Document titles are stored separately as readable text; they are not encrypted.
- Users must securely store their recovery keys.
- Losing both the document password and recovery key can result in permanent loss of access.
- Client-side encryption does not protect against a compromised device, malicious browser extensions, or compromised application code.

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/VIJAYK-UMAR/ShadowPad.git
```

### 2. Navigate to the project directory

```bash
cd ShadowPad
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholders with your own Supabase project details.

### 5. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal.

### 6. Build for production

```bash
npm run build
```

## 📸 Screenshots

Screenshots of the application will be added here.

https://github.com/VIJAYK-UMAR/ShadowPad/tree/main/screenshots

## 🌐 Live Application

Try ShadowPad here:

https://shadowpad.netlify.app/

## 🎯 Future Improvements

- Dedicated emergency information and contact section.
- Improved document organization.
- Additional privacy and usability enhancements.
- Further security testing and hardening.

## 👨‍💻 Developer

Developed as a personal project to explore web development, encryption, authentication, and practical cybersecurity concepts.

**GitHub:** https://github.com/VIJAYK-UMAR

---

⭐ If you find this project interesting, feel free to explore the repository and share your feedback!
