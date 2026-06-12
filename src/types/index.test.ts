/* eslint-disable @typescript-eslint/no-explicit-any */
import { toPaper, toSyllabus, toActivityLog, toAdminUser } from "./index";

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
    expect(paper.institute).toBe("Test Institute");
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
    expect(paper.institute).toBe("Fallback Uni");
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

  it("handles boolean string false explicitly", () => {
    const doc = {
      $id: "123",
      approved: "false",
    };
    const paper = toPaper(doc);
    expect(paper.approved).toBe(false);
  });
});

describe("toActivityLog", () => {
  it("maps valid Appwrite activity log document correctly", () => {
    const doc = {
      $id: "log123",
      action: "approve",
      target_user_id: "user456",
      target_paper_id: "paper789",
      admin_id: "admin101",
      admin_email: "admin@example.com",
      details: "Approved paper sample",
      $createdAt: "2023-01-01T00:00:00Z",
    };

    const entry = toActivityLog(doc);

    expect(entry.id).toBe("log123");
    expect(entry.action).toBe("approve");
    expect(entry.target_user_id).toBe("user456");
    expect(entry.target_paper_id).toBe("paper789");
    expect(entry.admin_id).toBe("admin101");
    expect(entry.admin_email).toBe("admin@example.com");
    expect(entry.details).toBe("Approved paper sample");
    expect(entry.created_at).toBe("2023-01-01T00:00:00Z");
  });

  it("handles empty details and fallback fields", () => {
    const doc = {
      id: "log123",
      created_at: "2023-01-01T00:00:00Z",
    };

    const entry = toActivityLog(doc as any);

    expect(entry.id).toBe("log123");
    expect(entry.action).toBe("approve");
    expect(entry.target_user_id).toBeNull();
    expect(entry.target_paper_id).toBeNull();
    expect(entry.admin_id).toBe("");
    expect(entry.admin_email).toBe("");
    expect(entry.details).toBe("");
    expect(entry.created_at).toBe("2023-01-01T00:00:00Z");
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

describe("toAdminUser", () => {
  it("maps valid Appwrite user document correctly", () => {
    const doc = {
      $id: "user123",
      email: "user@example.com",
      display_name: "John Doe",
      username: "johndoe",
      avatar_url: "https://example.com/avatar.jpg",
      role: "admin",
      primary_role: "admin",
      secondary_role: "moderator",
      tertiary_role: null,
      specialist_subject: "Math",
      subject_admin_subject: null,
      tier: "gold",
      upload_count: 5,
      xp: 100,
      streak_days: 10,
      last_login: "2023-01-01T00:00:00Z",
      $createdAt: "2023-01-01T00:00:00Z",
    };

    const user = toAdminUser(doc);

    expect(user.id).toBe("user123");
    expect(user.email).toBe("user@example.com");
    expect(user.name).toBe("John Doe");
    expect(user.username).toBe("johndoe");
    expect(user.avatar_url).toBe("https://example.com/avatar.jpg");
    expect(user.role).toBe("admin");
    expect(user.secondary_role).toBe("moderator");
    expect(user.tertiary_role).toBeNull();
    expect(user.specialist_subject).toBe("Math");
    expect(user.subject_admin_subject).toBeNull();
    expect(user.tier).toBe("gold");
    expect(user.upload_count).toBe(5);
    expect(user.xp).toBe(100);
    expect(user.streak_days).toBe(10);
    expect(user.last_login).toBe("2023-01-01T00:00:00Z");
    expect(user.created_at).toBe("2023-01-01T00:00:00Z");
  });

  it("handles fallback and missing fields in toAdminUser", () => {
    const doc = {
      id: "user123",
      name: "John Doe",
      streak: 5,
      last_activity: "2023-01-01T00:00:00Z",
      created_at: "2023-01-01T00:00:00Z",
    };

    const user = toAdminUser(doc as any);

    expect(user.id).toBe("user123");
    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("");
    expect(user.role).toBe("student");
    expect(user.primary_role).toBe("student");
    expect(user.secondary_role).toBeNull();
    expect(user.specialist_subject).toBeNull();
    expect(user.tier).toBe("bronze");
    expect(user.upload_count).toBe(0);
    expect(user.xp).toBe(0);
    expect(user.streak_days).toBe(5);
    expect(user.last_login).toBe("2023-01-01T00:00:00Z");
    expect(user.created_at).toBe("2023-01-01T00:00:00Z");
  });
});
