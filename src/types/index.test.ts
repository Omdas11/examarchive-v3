import { toPaper, toSyllabus } from "./index";

describe("toPaper", () => {
  it("maps valid Appwrite document to Paper", () => {
    const doc = {
      $id: "123",
      title: "Sample Paper",
      course_code: "CS101",
      course_name: "Computer Science",
      year: 2023,
      semester: "1",
      exam_type: "Regular",
      department: "CSE",
      file_url: "https://example.com/file.pdf",
      file_id: "fid123",
      uploaded_by: "user1",
      approved: true,
      $createdAt: "2023-01-01T00:00:00Z",
      stream: "B.Tech",
      institute: "Test Institute",
      programme: "UG",
      marks: 100,
      duration: 180,
      view_count: 10,
      download_count: 5,
      uploaded_by_username: "testuser",
      paper_type: "Solved",
    };

    const paper = toPaper(doc);

    expect(paper.id).toBe("123");
    expect(paper.title).toBe("Sample Paper");
    expect(paper.year).toBe(2023);
    expect(paper.approved).toBe(true);
    expect(paper.institution).toBe("Test Institute");
    expect(paper.marks).toBe(100);
    expect(paper.view_count).toBe(10);
  });

  it("handles string numbers and boolean strings", () => {
    const doc = {
      $id: "123",
      year: "2023 ",
      approved: "true",
      marks: " 100",
      view_count: "50",
      status: "pending",
    };

    const paper = toPaper(doc);

    expect(paper.year).toBe(2023);
    expect(paper.approved).toBe(true);
    expect(paper.marks).toBe(100);
    expect(paper.view_count).toBe(50);
  });

  it("uses fallback fields", () => {
    const doc = {
      id: "123",
      paper_name: "Fallback Title",
      paper_code: "FB101",
      subject: "Fallback Subject",
      uploader_id: "user1",
      status: "approved",
      university: "Fallback Uni",
      created_at: "2023-01-01T00:00:00Z",
    };

    const paper = toPaper(doc);

    expect(paper.id).toBe("123");
    expect(paper.title).toBe("Fallback Title");
    expect(paper.course_code).toBe("FB101");
    expect(paper.department).toBe("Fallback Subject");
    expect(paper.approved).toBe(true);
    expect(paper.institution).toBe("Fallback Uni");
  });

  it("handles missing optional numbers with defaults", () => {
    const doc = {
      $id: "123",
    };

    const paper = toPaper(doc);

    expect(paper.year).toBe(0);
    expect(paper.view_count).toBe(0);
    expect(paper.download_count).toBe(0);
    expect(paper.marks).toBeUndefined();
  });

  it("handles invalid number strings", () => {
    const doc = {
      $id: "123",
      year: "abc",
      marks: "invalid",
    };

    const paper = toPaper(doc);

    expect(paper.year).toBe(0);
    expect(paper.marks).toBeUndefined();
  });
});

describe("toSyllabus", () => {
  it("maps Appwrite document to Syllabus", () => {
    const doc = {
      $id: "s123",
      university: "Test Uni",
      subject: "Test Subject",
      department: "Test Dept",
      semester: "5",
      programme: "B.Tech",
      year: 2024,
      uploader_id: "u123",
      approval_status: "approved",
      file_url: "https://example.com/s.pdf",
      $createdAt: "2024-01-01T00:00:00Z",
      course_code: "CS202",
      is_hidden: true,
    };

    const syllabus = toSyllabus(doc);

    expect(syllabus.id).toBe("s123");
    expect(syllabus.university).toBe("Test Uni");
    expect(syllabus.year).toBe(2024);
    expect(syllabus.is_hidden).toBe(true);
  });

  it("uses fallback fields for syllabus", () => {
    const doc = {
      id: "s123",
      institution: "Legacy Uni",
      course_name: "Legacy Course",
      uploaded_by: "u123",
      created_at: "2024-01-01T00:00:00Z",
    };

    const syllabus = toSyllabus(doc);

    expect(syllabus.university).toBe("Legacy Uni");
    expect(syllabus.subject).toBe("Legacy Course");
    expect(syllabus.uploader_id).toBe("u123");
  });
});
