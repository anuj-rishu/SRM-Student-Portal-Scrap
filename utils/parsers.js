const cheerio = require("cheerio");

function parsePersonalDetails(html) {
  const $ = cheerio.load(html);
  const data = {};

  function getRowValue(label) {
    const row = $("table tbody tr")
      .filter((i, el) => {
        return $(el).find("td").first().text().trim() === label;
      })
      .first();
    return row.find("td").eq(1).text().trim() || "N/A";
  }

  data.studentName =
    getRowValue("Student Name") || getRowValue("Student Name ");
  data.registerNo = getRowValue("Register No.") || getRowValue("Register No. ");
  data.institution = getRowValue("Institution");
  data.program = getRowValue("Program");
  data.batch = getRowValue("Batch");
  data.semester = getRowValue("Semester");
  data.section = getRowValue("Section");

  data.dateOfBirth = getRowValue("Date of Birth");
  data.gender = getRowValue("Gender");
  data.nationality = getRowValue("Nationality");
  data.bloodGroup = getRowValue("Blood Group");

  data.fatherName = getRowValue("Father Name");
  data.motherName = getRowValue("Mother Name");
  data.parentContactNo = getRowValue("Parent Contact No.");
  data.parentEmailID = getRowValue("Parent Email ID");

  data.address = getRowValue("Address");
  data.pincode = getRowValue("Pincode");
  data.district = getRowValue("District");
  data.state = getRowValue("State");
  data.personalEmailID = getRowValue("Personal Email ID");
  data.studentMobileNo = getRowValue("Student Mobile No.");
  data.alternativeStudentMobileNo = getRowValue(
    "Alternative Student Mobile No."
  );

  return data;
}

function parseResultsData(html) {
  const $ = cheerio.load(html);

  if (html.includes("No Record found")) {
    return { hasResults: false, message: "No results available" };
  }

  const results = [];

  return {
    hasResults: results.length > 0,
    results,
  };
}

function parseHallTicketData(html) {
  const $ = cheerio.load(html);

  if (!html.includes("Download Hall Ticket")) {
    return { available: false, message: "No hall ticket available" };
  }

  const data = {
    available: true,
    examMonth: $("#exammonth").val(),
    examYear: $("#examyear").val(),
    courseId: $("#courseid").val(),
    studentId: $("#studentId").val(),
    studentSemesterId: $("#studentsemesterid").val(),
  };

  const buttonText = $("#cmddownload").text();
  const match = buttonText.match(/Download Hall Ticket \((.*?)\)/);
  if (match && match[1]) {
    data.description = match[1];
  }

  data.downloadUrl =
    "https://sp.srmist.edu.in/srmiststudentportal/students/report/StudentHallticketinner.jsp";

  return data;
}


// ...existing code...

/**
 * Parse student profile data from HTML
 */
function parseProfileData(html) {
  const $ = cheerio.load(html);
  const profile = {};
  
  try {
    // Extract basic profile information from table
    $('table.table-borderless tbody tr').each((i, el) => {
      const label = $(el).find('td').first().text().trim();
      const valueElement = $(el).find('td').last().find('div').first();
      const value = valueElement.text().trim();
      
      switch (label) {
        case 'Student Name':
          profile.studentName = value;
          break;
        case 'Student ID':
          profile.studentId = value;
          break;
        case 'Register No.':
          profile.registerNo = value;
          break;
        case 'Email ID':
          profile.emailId = value;
          break;
        case 'Institution':
          profile.institution = value;
          break;
        case 'Program':
          profile.program = value;
          break;
        case 'Faculty Advisor':
          profile.facultyAdvisor = value;
          break;
        case 'Academic Advisor':
          profile.academicAdvisor = value;
          break;
      }
    });
    
    // Extract student photo URL if available
    const photoSrc = $('.imgPhoto').attr('src');
    if (photoSrc) {
      // Convert relative URL to absolute
      profile.photoUrl = 'https://sp.srmist.edu.in/srmiststudentportal' + 
                        photoSrc.replace('../../', '/');
    }
    
    // Extract current status
    const statusElement = $('.large.font-weight-bold.text-custom.text-center');
    if (statusElement.length > 0) {
      const statusText = statusElement.text().trim();
      const match = statusText.match(/Current Status: (.*)/);
      if (match && match[1]) {
        profile.currentStatus = match[1];
      }
    }
    
    return profile;
  } catch (error) {
    console.error('Error parsing profile data:', error);
    return { error: 'Failed to parse profile data' };
  }
}



module.exports = {
  parsePersonalDetails,
      parseResultsData,
      parseHallTicketData,
      parseProfileData,
    };
