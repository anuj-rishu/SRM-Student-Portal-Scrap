# SRM Student Portal Scraper

A Node.js API that provides programmatic access to the SRM Institute Student Portal. This tool automates the login process (including CAPTCHA solving) and fetches student information such as personal details, profile information, exam results, and hall tickets.

## Features

- **Automated Login**: Handles authentication with automatic CAPTCHA recognition
- **Personal Details**: Fetch student personal information
- **Student Profile**: Get profile data including photo URL
- **Exam Results**: Access semester-wise academic results
- **Hall Tickets**: Download examination hall tickets

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Tesseract OCR (for CAPTCHA recognition)

## Installation

### Installing Tesseract OCR

#### macOS
```bash
brew install tesseract
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

#### Windows
Download and install from: https://github.com/UB-Mannheim/tesseract/wiki

### Project Setup

1. Clone the repository
```bash
git clone https://github.com/anuj-rishu/SRM-Student-Portal-Scrap.git
cd SRM-Student-Portal-Scrap
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the server
```bash
npm start
# or
yarn start
```

The server will start on http://localhost:9000

## API Endpoints

### Authentication

```
POST /auth/login
```

**Request Body:**
```json
{
  "regNo": "YOUR NET ID",
  "password": "YOUR_PASSWORD"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "SESSION_TOKEN"
  }
}
```

### Personal Details

```
GET /student/personal-details
```

**Request Headers:**
```
Authorization: Bearer SESSION_TOKEN
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "name": "Student Name",
    "regNo": "Registration Number",
    "dateOfBirth": "DOB",
    "email": "Email Address",
    "phone": "Phone Number",
    // Additional personal details
  }
}
```

### Student Profile

```
GET /student/profile
```

**Request Headers:**
```
Authorization: Bearer SESSION_TOKEN
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "name": "Student Name",
    "regNo": "Registration Number",
    "branch": "Branch Name",
    "photoUrl": "URL to student photo",
    // Additional profile information
  }
}
```

### Exam Results

```
GET /academic/results
```

**Request Headers:**
```
Authorization: Bearer SESSION_TOKEN
```

**Query Parameters:**
```
semester: SEMESTER_NUMBER (optional)
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "semester": "Semester Number",
    "gpa": "GPA",
    "courses": [
      {
        "code": "Course Code",
        "title": "Course Title",
        "credits": "Credits",
        "grade": "Grade"
      }
      // More courses
    ]
  }
}
```

### Hall Ticket

```
GET /academic/hall-ticket
```

**Request Headers:**
```
Authorization: Bearer SESSION_TOKEN
```

**Query Parameters:**
```
examType: EXAM_TYPE (e.g., "midterm", "endterm")
```

**Response:**
Returns PDF file of the hall ticket or:
```json
{
  "status": "error",
  "message": "Hall ticket not available"
}
```



## Important Notes

- This is an unofficial tool and not affiliated with SRM Institute
- Use responsibly and only with your own credentials
- The SRM portal structure may change, which could break functionality
- CAPTCHA recognition may occasionally fail, resulting in login errors

## Troubleshooting

- If login fails, try again as CAPTCHA recognition isn't 100% accurate
- Ensure Tesseract OCR is properly installed on your system
- Check that your SRM portal credentials are valid
- If you encounter persistent issues, check for updates to the library

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is available under the CC BY-NC-ND 4.0 License.
