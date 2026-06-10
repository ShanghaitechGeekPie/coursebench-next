import { sql } from "../db.mjs";
import readline from "readline";

const TEACHER_OTHER_ID = 100000001;
const ELRC_BASE = "https://elrc.shanghaitech.edu.cn";

function parseSemester(arg) {
  const parts = arg.split("-");
  if (parts.length !== 3) throw new Error("Invalid semester format, expect 2024-2025-3");
  const termMap = { "1": "秋季", "2": "春季", "3": "夏季" };
  const termName = termMap[parts[2]];
  if (!termName) throw new Error(`Invalid term number: ${parts[2]}`);
  return {
    year: `${parts[0]}-${parts[1]}`,
    termNum: parts[2],
    termName,
    fullLabel: `${parts[0]}-${parts[1]}学年${termName}`,
  };
}

async function confirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function fetchCourseList(semInfo) {
  const allCourses = [];
  let page = 1;
  let pageSize = 20;
  let totalPages = 1;

  while (true) {
    process.stdout.write(`\rFetching page ${page}/${totalPages}...`);
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
      courseType: "2",
      semester: semInfo.fullLabel,
    });

    const resp = await fetch(`${ELRC_BASE}/learn/shanghai/tech/get/course?${params}`);
    if (!resp.ok) { console.log(`\nBad response: ${resp.status}`); break; }

    const data = await resp.json();
    const results = data.data?.results || [];
    if (results.length === 0) break;

    allCourses.push(...results);

    if (page === 1) {
      pageSize = data.data.size || 20;
      const total = data.data.total || 0;
      totalPages = Math.ceil(total / pageSize);
    }

    if (page >= totalPages) break;
    page++;
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("");
  return allCourses;
}

export async function fetchCourseDetailFrom(endpoint, serialNumber, semInfo) {
  const params = new URLSearchParams({
    semester: semInfo.year,
    term: semInfo.termNum,
    course_no: serialNumber,
    course_id: "undefined",
  });

  const resp = await fetch(`${ELRC_BASE}/shanghaitechdatasync/datasync/${endpoint}/?${params}`);
  if (!resp.ok) return null;

  const data = await resp.json();
  if (data.error_code !== "shanghaitech.0000.0000") return null;
  return data.extend_message || null;
}

export function normalizeCourseDetail(extendMessage, kind) {
  if (!extendMessage) return null;

  const courseInfo = kind === "yjs"
    ? extendMessage.JwPkKcxxYjs_instance
    : extendMessage.JwPkKcxxBk_instance;
  const activity = kind === "yjs"
    ? extendMessage.KczxCourseActivityYjs_instance
    : extendMessage.KczxCourseActivityBk_instance;

  const creditValue = parseFloat(courseInfo?.credits ?? "");
  const credit = Number.isFinite(creditValue) ? Math.floor(creditValue) : null;
  const institute = activity?.college_name || null;

  if (credit === null && !institute) return null;
  return { credit, institute, kind };
}

export async function fetchCourseDetail(serialNumber, semInfo) {
  const bkDetail = normalizeCourseDetail(await fetchCourseDetailFrom("bksCourse", serialNumber, semInfo), "bk");
  if (bkDetail) return bkDetail;

  return normalizeCourseDetail(await fetchCourseDetailFrom("yjsCourse", serialNumber, semInfo), "yjs");
}

function buildCourseBasics(courseInfo, detail) {
  return {
    name: courseInfo.name_,
    credit: detail?.credit ?? null,
    institute: detail?.institute || null,
  };
}

function diffCourseBasics(existing, basics) {
  const changes = {};

  if (basics.name && basics.name !== existing.name) {
    changes.name = { from: existing.name || "", to: basics.name };
  }
  if (basics.credit !== null && Number(existing.credit) !== basics.credit) {
    changes.credit = { from: Number(existing.credit) || 0, to: basics.credit };
  }
  if (basics.institute && basics.institute !== existing.institute) {
    changes.institute = { from: existing.institute || "", to: basics.institute };
  }

  return changes;
}

function courseTeacherSetKey(courseInfo) {
  const teacherIds = (courseInfo.teacher || [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
  const uniqueTeacherIds = [...new Set(teacherIds)];
  return `${courseInfo.courseNumber}:${uniqueTeacherIds.join(",")}`;
}

function uniqueSortedNumbers(values) {
  return [...new Set(values.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function teacherIdSetKey(teacherIds) {
  return uniqueSortedNumbers(teacherIds).join(",");
}

function missingTeacherSetKey(teacherIds, teacherNames) {
  const keys = [];
  for (let i = 0; i < teacherIds.length; i++) {
    const uniId = parseInt(teacherIds[i], 10);
    const name = teacherNames[i] || "";
    if (Number.isFinite(uniId) && name) keys.push(`${uniId}:${name}`);
  }
  return [...new Set(keys)].sort().join(",");
}

function expectedTeacherIdsForCourse(courseInfo, teachersByUniId, teachersByName) {
  const teacherIds = [];
  const missingTeacherUniIds = [];
  const missingTeacherNames = [];
  const teacherUniIds = courseInfo.teacher || [];
  const teacherNames = courseInfo.teacher_names || [];

  for (let i = 0; i < teacherUniIds.length; i++) {
    const uniId = parseInt(teacherUniIds[i], 10);
    const name = teacherNames[i] || "";
    const teacher = (Number.isFinite(uniId) && teachersByUniId.get(String(uniId))) || teachersByName.get(name);
    if (teacher) {
      teacherIds.push(Number(teacher.id));
    } else if (Number.isFinite(uniId) && name) {
      missingTeacherUniIds.push(teacherUniIds[i]);
      missingTeacherNames.push(name);
    }
  }

  const hasMissingTeacher = missingTeacherUniIds.length > 0;
  if (teacherIds.length === 0 && !hasMissingTeacher) teacherIds.push(TEACHER_OTHER_ID);
  return {
    teacherIds: uniqueSortedNumbers(teacherIds),
    hasMissingTeacher,
    missingTeacherKey: missingTeacherSetKey(missingTeacherUniIds, missingTeacherNames),
  };
}

// ── Dry-run analysis ──

async function analyzeCourses(courses, semInfo, { updateExisting = false } = {}) {
  const newCourses = [];
  const existingCourses = [];
  const courseUpdates = [];
  const teacherSyncCourses = [];
  const newTeachers = []; // { name, uniId, institute }
  const seenTeacherSyncKeys = new Set();
  const seenNewCourseKeys = new Set();
  const allTeacherNames = new Set();
  const seenNewTeachers = new Set();

  // Prefetch existing courses
  const existingCoursesByCode = new Map();
  const rows = await sql`SELECT id, name, institute, credit, code FROM courses WHERE deleted_at IS NULL`;
  for (const r of rows) existingCoursesByCode.set(r.code, r);

  // Prefetch existing teachers
  const existingTeacherNames = new Set();
  const teachersByUniId = new Map();
  const teachersByName = new Map();
  const tRows = await sql`SELECT id, name, uni_id FROM teachers WHERE deleted_at IS NULL`;
  for (const r of tRows) {
    existingTeacherNames.add(r.name);
    if (r.uni_id !== null && r.uni_id !== undefined) teachersByUniId.set(String(r.uni_id), r);
    if (r.name) teachersByName.set(r.name, r);
  }

  // Prefetch existing group teacher sets by course code so preview only syncs missing sets.
  const groupSetsByCourseCode = new Map();
  const groupRows = await sql`
    SELECT c.code, array_agg(cgt.teacher_id ORDER BY cgt.teacher_id) AS teacher_ids
    FROM course_groups cg
    INNER JOIN courses c ON c.id = cg.course_id
    INNER JOIN coursegroup_teachers cgt ON cgt.course_group_id = cg.id
    WHERE cg.deleted_at IS NULL AND c.deleted_at IS NULL
    GROUP BY c.code, cg.id`;
  for (const r of groupRows) {
    if (!groupSetsByCourseCode.has(r.code)) groupSetsByCourseCode.set(r.code, new Set());
    groupSetsByCourseCode.get(r.code).add(teacherIdSetKey(r.teacher_ids || []));
  }

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    process.stdout.write(`\rAnalyzing ${i + 1}/${courses.length}: ${c.courseNumber}...`);

    const teacherNames = c.teacher_names || [];
    const teacherUniIds = c.teacher || [];
    for (const n of teacherNames) allTeacherNames.add(n);

    const existingCourse = existingCoursesByCode.get(c.courseNumber);
    if (existingCourse) {
      existingCourses.push(c);
      if (updateExisting) {
        const detail = await fetchCourseDetail(c.serialNumber, semInfo);
        const basics = buildCourseBasics(c, detail);
        const changes = diffCourseBasics(existingCourse, basics);
        if (Object.keys(changes).length > 0) {
          courseUpdates.push({ course: existingCourse, courseInfo: c, changes });
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    } else {
      const newCourseKey = courseTeacherSetKey(c);
      if (!seenNewCourseKeys.has(newCourseKey)) {
        seenNewCourseKeys.add(newCourseKey);
        // Fetch detail for credit/course institute. ELRC lists can contain both undergraduate
        // and graduate courses; fetchCourseDetail falls back from bksCourse to yjsCourse.
        const detail = await fetchCourseDetail(c.serialNumber, semInfo);
        const basics = buildCourseBasics(c, detail);
        const credit = basics.credit ?? 0;
        const courseInstitute = basics.institute || "未知单位";
        newCourses.push({ ...c, _credit: credit, _institute: courseInstitute });
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    // Check for new teachers, resolve their real institute
    if (existingCourse) {
      const { teacherIds, hasMissingTeacher, missingTeacherKey } = expectedTeacherIdsForCourse(c, teachersByUniId, teachersByName);
      const teacherSyncKey = `${c.courseNumber}:${teacherIdSetKey(teacherIds)}:${hasMissingTeacher ? `missing:${missingTeacherKey}` : "ready"}`;
      const existingGroupSets = groupSetsByCourseCode.get(c.courseNumber) || new Set();
      if (!seenTeacherSyncKeys.has(teacherSyncKey) && (hasMissingTeacher || !existingGroupSets.has(teacherIdSetKey(teacherIds)))) {
        seenTeacherSyncKeys.add(teacherSyncKey);
        teacherSyncCourses.push(c);
      }
    }
    for (let j = 0; j < teacherNames.length; j++) {
      const name = teacherNames[j];
      if (existingTeacherNames.has(name) || seenNewTeachers.has(name)) continue;
      seenNewTeachers.add(name);

      const uniId = parseInt(teacherUniIds[j], 10) || 0;
      const institute = await resolveTeacherInstitute(uniId, name, "");
      newTeachers.push({ name, uniId, institute });
    }
  }
  console.log("");

  return { newCourses, existingCourses, courseUpdates, teacherSyncCourses, newTeachers, allTeacherNames };
}

function printPreview({ newCourses, existingCourses, courseUpdates, teacherSyncCourses, newTeachers, allTeacherNames }, semInfo, { updateExisting = false } = {}) {
  const divider = "─".repeat(60);

  console.log(`\n${divider}`);
  console.log(`  ELRC Import Preview — ${semInfo.fullLabel}`);
  console.log(`${divider}\n`);

  console.log(`  Total courses from API:   ${newCourses.length + existingCourses.length}`);
  console.log(`  New courses to add:       ${newCourses.length}`);
  console.log(`  Already in database:      ${existingCourses.length}`);
  if (updateExisting) console.log(`  Existing course updates: ${courseUpdates.length}`);
  console.log(`  New teachers to create:   ${newTeachers.length}`);
  console.log(`  Courses to sync teachers: ${newCourses.length + teacherSyncCourses.length}`);
  console.log(`  Total unique teachers:    ${allTeacherNames.size}`);

  if (newCourses.length > 0) {
    console.log(`\n${divider}`);
    console.log(`  New Courses (${newCourses.length})`);
    console.log(`${divider}`);
    // Group by institute
    const byInstitute = {};
    for (const c of newCourses) {
      const inst = c._institute || "未知单位";
      if (!byInstitute[inst]) byInstitute[inst] = [];
      byInstitute[inst].push(c);
    }
    for (const [inst, courses] of Object.entries(byInstitute).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  📚 ${inst} (${courses.length})`);
      for (const c of courses) {
        const teachers = (c.teacher_names || []).join(", ") || "未知";
        console.log(`     ${c.courseNumber.padEnd(12)} ${c.name_.padEnd(30)} ${String(c._credit).padStart(2)}学分  👤 ${teachers}`);
      }
    }
  }

  if (courseUpdates.length > 0) {
    console.log(`\n${divider}`);
    console.log(`  Existing Course Updates (${courseUpdates.length})`);
    console.log(`${divider}`);
    for (const u of courseUpdates) {
      const parts = [];
      if (u.changes.name) parts.push(`名称: ${u.changes.name.from} → ${u.changes.name.to}`);
      if (u.changes.credit) parts.push(`学分: ${u.changes.credit.from} → ${u.changes.credit.to}`);
      if (u.changes.institute) parts.push(`学院: ${u.changes.institute.from || "未知"} → ${u.changes.institute.to}`);
      console.log(`     Δ ${u.courseInfo.courseNumber.padEnd(12)} ${parts.join("; ")}`);
    }
  }

  if (newTeachers.length > 0) {
    console.log(`\n${divider}`);
    console.log(`  New Teachers (${newTeachers.length})`);
    console.log(`${divider}`);
    for (const t of newTeachers) {
      const inst = t.institute || "未知单位";
      const uid = t.uniId ? String(t.uniId) : "(无)";
      console.log(`     + ${t.name.padEnd(16)} UniID: ${uid.padEnd(8)} 学院: ${inst}`);
    }
  }

  if (existingCourses.length > 0 && existingCourses.length <= 20) {
    console.log(`\n${divider}`);
    console.log(`  Existing Courses (${updateExisting ? "checked" : "skipped"}, ${existingCourses.length})`);
    console.log(`${divider}`);
    for (const c of existingCourses) {
      console.log(`     ✓ ${c.courseNumber.padEnd(12)} ${c.name_}`);
    }
  } else if (existingCourses.length > 20) {
    console.log(`\n  (${existingCourses.length} existing courses omitted)`);
  }

  console.log(`\n${divider}\n`);
}

// ── ELRC teacher search (for real institute) ──

// Cache: userCode → { nickName, college }
const elrcTeacherCache = new Map();

async function fetchTeacherFromELRC(name) {
  const params = new URLSearchParams({ page: "1", size: "5", name, wholeMatch: "true" });
  try {
    const resp = await fetch(`${ELRC_BASE}/learn/v1/search/history/search/teacher?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.results || [];
  } catch {
    return null;
  }
}

/**
 * Resolve the real institute for a teacher via ELRC search API.
 * Matches by userCode (uni_id). Falls back to single-result match by name.
 * Returns the college string, or fallbackInstitute if not found.
 */
async function resolveTeacherInstitute(uniId, name, fallbackInstitute) {
  // Check cache first
  if (uniId && elrcTeacherCache.has(uniId)) {
    return elrcTeacherCache.get(uniId).college || fallbackInstitute;
  }

  const results = await fetchTeacherFromELRC(name);
  if (!results || results.length === 0) return fallbackInstitute;

  // Cache all results
  for (const r of results) {
    const code = parseInt(r.userCode, 10);
    if (code) elrcTeacherCache.set(code, r);
  }

  // Match by userCode
  if (uniId) {
    const match = results.find((r) => String(r.userCode) === String(uniId));
    if (match?.college) return match.college;
  }

  // Single result → use it
  if (results.length === 1 && results[0].college) return results[0].college;

  return fallbackInstitute;
}

// ── Execute import ──

async function findOrCreateTeacher(uniId, name, courseInstitute) {
  // Resolve real institute from ELRC search API
  const institute = await resolveTeacherInstitute(uniId, name, courseInstitute);

  let [teacher] = await sql`SELECT * FROM teachers WHERE uni_id = ${uniId} AND deleted_at IS NULL`;
  if (teacher) {
    let needUpdate = false;
    if (!teacher.name && name) needUpdate = true;
    if (institute && institute !== teacher.institute) needUpdate = true;
    if (needUpdate) {
      await sql`UPDATE teachers SET
        name = COALESCE(NULLIF(name, ''), ${name}),
        institute = ${institute || teacher.institute || ""},
        updated_at = NOW()
        WHERE id = ${teacher.id}`;
    }
    return teacher;
  }

  [teacher] = await sql`SELECT * FROM teachers WHERE name = ${name} AND deleted_at IS NULL LIMIT 1`;
  if (teacher) {
    const updateInst = institute || teacher.institute || "";
    await sql`UPDATE teachers SET uni_id = ${uniId}, institute = ${updateInst}, updated_at = NOW() WHERE id = ${teacher.id}`;
    return teacher;
  }

  const [newTeacher] = await sql`INSERT INTO teachers (name, uni_id, institute, job, introduction, email, photo, created_at, updated_at)
    VALUES (${name}, ${uniId}, ${institute || ""}, '', '', '', '', NOW(), NOW()) RETURNING *`;
  console.log(`  + Teacher: ${name} (UniID: ${uniId}, institute: ${institute})`);
  return newTeacher;
}

async function updateCourseBasics(update) {
  const nextName = update.changes.name?.to ?? update.course.name;
  const nextCredit = update.changes.credit?.to ?? (Number(update.course.credit) || 0);
  const nextInstitute = update.changes.institute?.to ?? update.course.institute ?? "";

  await sql`UPDATE courses SET
    name = ${nextName},
    credit = ${nextCredit},
    institute = ${nextInstitute},
    updated_at = NOW()
    WHERE id = ${update.course.id}`;

  console.log(`  ~ ${update.course.code} updated`);
}

async function processCourse(courseInfo, semInfo) {
  const detail = await fetchCourseDetail(courseInfo.serialNumber, semInfo);

  const credit = detail?.credit ?? 0;
  const institute = detail?.institute || "未知单位";

  let [course] = await sql`SELECT * FROM courses WHERE code = ${courseInfo.courseNumber} AND deleted_at IS NULL`;
  let courseCreated = false;

  if (!course) {
    [course] = await sql`INSERT INTO courses (name, institute, credit, code, scores, comment_count, created_at, updated_at)
      VALUES (${courseInfo.name_}, ${institute}, ${credit}, ${courseInfo.courseNumber}, ${[0, 0, 0, 0]}, 0, NOW(), NOW()) RETURNING *`;
    courseCreated = true;
  }

  const teacherIds = [];
  const teachers = {};
  for (let i = 0; i < (courseInfo.teacher || []).length; i++) {
    const uniIdStr = courseInfo.teacher[i];
    const name = (courseInfo.teacher_names || [])[i] || "";
    if (uniIdStr && name) teachers[uniIdStr] = name;
  }

  for (const [uniIdStr, name] of Object.entries(teachers)) {
    const uniId = parseInt(uniIdStr, 10);
    if (isNaN(uniId)) continue;
    const teacher = await findOrCreateTeacher(uniId, name, institute);
    const teacherId = Number(teacher.id);
    if (Number.isFinite(teacherId)) teacherIds.push(teacherId);
  }

  if (teacherIds.length === 0) teacherIds.push(TEACHER_OTHER_ID);

  const existingGroups = await sql`
    SELECT cg.id, array_agg(cgt.teacher_id ORDER BY cgt.teacher_id) as teacher_ids
    FROM course_groups cg
    INNER JOIN coursegroup_teachers cgt ON cg.id = cgt.course_group_id
    WHERE cg.course_id = ${course.id} AND cg.deleted_at IS NULL
    GROUP BY cg.id`;

  const sortedIds = [...new Set(teacherIds.map(Number))].sort((a, b) => a - b);
  const isDuplicate = existingGroups.some((g) => {
    const existing = [...new Set((g.teacher_ids || []).map(Number))].sort((a, b) => a - b);
    return existing.length === sortedIds.length && existing.every((v, i) => v === sortedIds[i]);
  });

  if (isDuplicate) {
    if (courseCreated) console.log(`  + ${courseInfo.courseNumber} ${courseInfo.name_} (course=${course.id})`);
    return { courseCreated, groupCreated: false };
  }

  const [group] = await sql`INSERT INTO course_groups (code, course_id, scores, comment_count, created_at, updated_at)
    VALUES ('', ${course.id}, ${[0, 0, 0, 0]}, 0, NOW(), NOW()) RETURNING *`;

  for (const tid of sortedIds) {
    await sql`INSERT INTO coursegroup_teachers (course_group_id, teacher_id) VALUES (${group.id}, ${tid}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO course_teachers (course_id, teacher_id) VALUES (${course.id}, ${tid}) ON CONFLICT DO NOTHING`;
  }

  const marker = courseCreated ? "+" : "~";
  console.log(`  ${marker} ${courseInfo.courseNumber} ${courseInfo.name_} (course=${course.id} group=${group.id})`);
  await new Promise((r) => setTimeout(r, 50));
  return { courseCreated, groupCreated: true };
}

// ── Entry point ──

export async function importELRC(semesterArg, { dryRun = false, updateExisting = false } = {}) {
  const semInfo = parseSemester(semesterArg);
  console.log(`Semester: ${semInfo.fullLabel} (year=${semInfo.year}, term=${semInfo.termNum})`);

  const courses = await fetchCourseList(semInfo);
  console.log(`Fetched ${courses.length} courses from ELRC API`);

  if (courses.length === 0) {
    console.log("No courses found. Exiting.");
    return;
  }

  // Always analyze and preview first
  const analysis = await analyzeCourses(courses, semInfo, { updateExisting });
  printPreview(analysis, semInfo, { updateExisting });

  if (dryRun) {
    console.log("Dry run complete. No changes were made.");
    return;
  }

  if (analysis.newCourses.length === 0 && analysis.courseUpdates.length === 0 && analysis.teacherSyncCourses.length === 0) {
    console.log("No new courses, course updates, or teacher groups to sync. Done.");
    return;
  }

  const actions = [];
  if (analysis.newCourses.length > 0) actions.push(`${analysis.newCourses.length} new courses`);
  if (analysis.teacherSyncCourses.length > 0) actions.push(`${analysis.teacherSyncCourses.length} existing courses for teacher sync`);
  if (analysis.courseUpdates.length > 0) actions.push(`${analysis.courseUpdates.length} existing course updates`);
  const ok = await confirm(`Apply ${actions.join(" and ")}?`);
  if (!ok) { console.log("Aborted."); return; }

  let updated = 0;
  for (const update of analysis.courseUpdates) {
    try {
      await updateCourseBasics(update);
      updated++;
    } catch (err) {
      console.error(`Error updating ${update.course.code}: ${err.message}`);
    }
  }

  let imported = 0;
  let groupsSynced = 0;
  for (const courseInfo of [...analysis.newCourses, ...analysis.teacherSyncCourses]) {
    try {
      const result = await processCourse(courseInfo, semInfo);
      if (result?.courseCreated) imported++;
      if (result?.groupCreated && !result.courseCreated) groupsSynced++;
    } catch (err) {
      console.error(`Error processing ${courseInfo.courseNumber}: ${err.message}`);
    }
  }

  console.log(`\nFinished: ${imported} courses imported, ${groupsSynced} teacher groups synced, ${updated} courses updated`);
}
