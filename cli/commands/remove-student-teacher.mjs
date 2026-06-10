import { sql } from "../db.mjs";

const TEACHER_ASSISTANT_ID = 1069;
const STUDENT_UNI_ID_MIN = 2000000000;
const STUDENT_UNI_ID_MAX = 2099999999;

function scoreArray(scores) {
  return (scores || [0, 0, 0, 0]).map(Number);
}

function teacherSetKey(teacherIds) {
  return [...new Set(teacherIds.map(Number))].sort((a, b) => a - b).join(",");
}

async function mergeDuplicateGroupsForCourse(courseId) {
  const groups = await sql`
    SELECT cg.id, cg.scores, cg.comment_count,
      array_agg(cgt.teacher_id ORDER BY cgt.teacher_id) as teacher_ids
    FROM course_groups cg
    INNER JOIN coursegroup_teachers cgt ON cg.id = cgt.course_group_id
    WHERE cg.course_id = ${courseId} AND cg.deleted_at IS NULL
    GROUP BY cg.id, cg.scores, cg.comment_count
    ORDER BY cg.id`;

  const groupsByTeacherSet = new Map();
  for (const group of groups) {
    const key = teacherSetKey(group.teacher_ids || []);
    if (!groupsByTeacherSet.has(key)) groupsByTeacherSet.set(key, []);
    groupsByTeacherSet.get(key).push(group);
  }

  let merged = 0;
  for (const dupes of groupsByTeacherSet.values()) {
    if (dupes.length <= 1) continue;

    const main = dupes[0];
    const mainScores = scoreArray(main.scores);
    let mergedCommentCount = Number(main.comment_count || 0);

    for (const dup of dupes.slice(1)) {
      const dupScores = scoreArray(dup.scores);
      for (let i = 0; i < mainScores.length && i < dupScores.length; i++) {
        mainScores[i] += dupScores[i];
      }
      mergedCommentCount += Number(dup.comment_count || 0);

      await sql`UPDATE comments SET course_group_id = ${main.id}, updated_at = NOW() WHERE course_group_id = ${dup.id} AND deleted_at IS NULL`;
      await sql`UPDATE course_groups SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${dup.id}`;
      await sql`DELETE FROM coursegroup_teachers WHERE course_group_id = ${dup.id}`;
      merged++;
    }

    await sql`UPDATE course_groups SET scores = ${mainScores}, comment_count = ${mergedCommentCount}, updated_at = NOW() WHERE id = ${main.id}`;
  }

  return merged;
}

export async function removeStudentTeacher({ dryRun = false } = {}) {
  const [assistant] = await sql`SELECT id, name FROM teachers WHERE id = ${TEACHER_ASSISTANT_ID} AND deleted_at IS NULL`;
  if (!assistant) throw new Error(`Teacher assistant id ${TEACHER_ASSISTANT_ID} not found`);

  const studentTeachers = await sql`
    SELECT id, name, uni_id
    FROM teachers
    WHERE deleted_at IS NULL
      AND uni_id >= ${STUDENT_UNI_ID_MIN}
      AND uni_id <= ${STUDENT_UNI_ID_MAX}
    ORDER BY id`;

  if (studentTeachers.length === 0) {
    console.log("No student teachers found.");
    return;
  }

  const studentTeacherIds = studentTeachers.map((t) => Number(t.id));

  const affectedGroups = await sql`
    SELECT DISTINCT cg.id, cg.course_id, c.code
    FROM course_groups cg
    INNER JOIN courses c ON c.id = cg.course_id
    INNER JOIN coursegroup_teachers cgt ON cgt.course_group_id = cg.id
    WHERE cg.deleted_at IS NULL
      AND cgt.teacher_id = ANY(${studentTeacherIds})
    ORDER BY cg.course_id, cg.id`;

  const affectedCourses = [...new Set(affectedGroups.map((g) => Number(g.course_id)))];

  console.log(`Student teachers: ${studentTeachers.length}`);
  console.log(`Affected groups:  ${affectedGroups.length}`);
  console.log(`Affected courses: ${affectedCourses.length}`);
  console.log(`Target teacher:   ${assistant.name} (${TEACHER_ASSISTANT_ID})`);

  for (const teacher of studentTeachers.slice(0, 30)) {
    console.log(`  - ${teacher.id} ${teacher.name} UniID: ${teacher.uni_id}`);
  }
  if (studentTeachers.length > 30) console.log(`  ... ${studentTeachers.length - 30} more student teachers omitted`);

  if (dryRun) {
    console.log("Dry run complete. No changes were made.");
    return;
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO coursegroup_teachers (course_group_id, teacher_id)
      SELECT DISTINCT cgt.course_group_id, ${TEACHER_ASSISTANT_ID}::bigint
      FROM coursegroup_teachers cgt
      INNER JOIN course_groups cg ON cg.id = cgt.course_group_id
      WHERE cg.deleted_at IS NULL
        AND cgt.teacher_id = ANY(${studentTeacherIds})
        AND NOT EXISTS (
          SELECT 1 FROM coursegroup_teachers existing
          WHERE existing.course_group_id = cgt.course_group_id
            AND existing.teacher_id = ${TEACHER_ASSISTANT_ID}::bigint
        )`;

    await tx`
      DELETE FROM coursegroup_teachers
      WHERE teacher_id = ANY(${studentTeacherIds})`;

    await tx`
      INSERT INTO course_teachers (course_id, teacher_id)
      SELECT DISTINCT ct.course_id, ${TEACHER_ASSISTANT_ID}::bigint
      FROM course_teachers ct
      WHERE ct.teacher_id = ANY(${studentTeacherIds})
        AND NOT EXISTS (
          SELECT 1 FROM course_teachers existing
          WHERE existing.course_id = ct.course_id
            AND existing.teacher_id = ${TEACHER_ASSISTANT_ID}::bigint
        )`;

    await tx`
      DELETE FROM course_teachers
      WHERE teacher_id = ANY(${studentTeacherIds})`;

    await tx`
      UPDATE teachers
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ANY(${studentTeacherIds})`;
  });

  let mergedGroups = 0;
  for (const courseId of affectedCourses) {
    mergedGroups += await mergeDuplicateGroupsForCourse(courseId);
  }

  console.log(`\nFinished:`);
  console.log(`  Student teachers removed: ${studentTeachers.length}`);
  console.log(`  Groups normalized:        ${affectedGroups.length}`);
  console.log(`  Duplicate groups merged:  ${mergedGroups}`);
}
