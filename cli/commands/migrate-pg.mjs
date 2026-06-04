/**
 * Migrate Postgres data from DATABASE_URL (source) to DATABASE_URL_DEST (target).
 *
 * Prereqs:
 *   - .env.local has both DATABASE_URL and DATABASE_URL_DEST.
 *   - Target schema is already created (e.g. via `pnpm drizzle-kit push` against DATABASE_URL_DEST).
 *
 * Usage:
 *   pnpm cli migrate_pg --dry-run     # report row counts only
 *   pnpm cli migrate_pg               # copy; refuses if target tables non-empty
 *   pnpm cli migrate_pg --truncate    # TRUNCATE target tables first, then copy
 */
import postgres from "postgres";
import { loadDotEnvLocal } from "../env.mjs";

// Tables in dependency order (parents before children).
// Junction tables have no `id` / sequence.
const TABLES = [
  {
    name: "users",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "email", "casdoor_sub", "password", "nick_name", "real_name",
      "year", "grade", "is_active", "avatar", "is_anonymous",
      "is_admin", "is_community_admin", "invitation_code",
      "invited_by_user_id", "reward", "has_posted_comments",
    ],
    hasId: true,
  },
  {
    name: "teachers",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "eams_id", "uni_id", "name", "institute", "job",
      "introduction", "email", "photo",
    ],
    hasId: true,
  },
  {
    name: "courses",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "name", "institute", "credit", "code", "scores", "comment_count",
    ],
    hasId: true,
  },
  {
    name: "course_groups",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "code", "course_id", "scores", "comment_count",
    ],
    hasId: true,
  },
  {
    name: "course_teachers",
    cols: ["course_id", "teacher_id"],
    hasId: false,
  },
  {
    name: "coursegroup_teachers",
    cols: ["course_group_id", "teacher_id"],
    hasId: false,
  },
  {
    name: "comments",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "user_id", "course_group_id", "course_id", "semester", "scores",
      "title", "content", "student_score_ranking", "is_anonymous",
      "create_time", "update_time", "like", "dislike",
      "is_fold", "is_covered", "cover_title", "cover_content",
      "cover_reason", "reward",
    ],
    hasId: true,
  },
  {
    name: "comment_likes",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "user_id", "comment_id", "is_like",
    ],
    hasId: true,
  },
  {
    name: "replies",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "comment_id", "parent_reply_id", "user_id", "content",
      "is_anonymous", "like", "dislike",
      "create_time", "update_time", "is_fold",
    ],
    hasId: true,
  },
  {
    name: "reply_likes",
    cols: [
      "id", "created_at", "updated_at", "deleted_at",
      "user_id", "reply_id", "is_like",
    ],
    hasId: true,
  },
  {
    name: "metadata",
    cols: ["id", "created_at", "updated_at", "deleted_at", "db_version"],
    hasId: true,
  },
];

const BATCH_SIZE = 500;

export async function migratePg({ dryRun = false, truncate = false } = {}) {
  loadDotEnvLocal();

  const SRC = process.env.DATABASE_URL;
  const DST = process.env.DATABASE_URL_DEST;
  if (!SRC) throw new Error("DATABASE_URL (source) not set in .env.local");
  if (!DST) throw new Error("DATABASE_URL_DEST (target) not set in .env.local");
  if (SRC === DST) {
    throw new Error("DATABASE_URL and DATABASE_URL_DEST are identical — refusing to migrate onto itself");
  }

  const src = postgres(SRC);
  const dst = postgres(DST);

  console.log(`Source: ${maskUrl(SRC)}`);
  console.log(`Target: ${maskUrl(DST)}`);
  console.log(`Mode:   ${dryRun ? "DRY-RUN (read only)" : truncate ? "TRUNCATE + COPY" : "COPY (target must be empty)"}\n`);

  try {
    // 1) Schema check on target
    for (const t of TABLES) {
      const rows = await dst`SELECT to_regclass(${`public.${t.name}`}) AS regclass`;
      if (!rows[0] || !rows[0].regclass) {
        throw new Error(
          `Target table "${t.name}" does not exist. Run \`pnpm drizzle-kit push\` against DATABASE_URL_DEST first.`,
        );
      }
    }

    // 2) Empty-check on target unless --truncate or --dry-run
    if (!dryRun && !truncate) {
      for (const t of TABLES) {
        const rows = await dst.unsafe(`SELECT count(*)::int AS cnt FROM ${qIdent(t.name)}`);
        if (rows[0].cnt > 0) {
          throw new Error(
            `Target table "${t.name}" already has ${rows[0].cnt} rows. ` +
            `Re-run with --truncate to overwrite, or empty it manually.`,
          );
        }
      }
    }

    // 3) Migrate each table
    let totalCopied = 0;
    for (const t of TABLES) {
      const srcRows = await src.unsafe(`SELECT count(*)::int AS cnt FROM ${qIdent(t.name)}`);
      const srcCount = srcRows[0].cnt;
      console.log(`[${t.name}] source rows: ${srcCount}`);

      if (dryRun) continue;

      if (truncate) {
        console.log(`[${t.name}] TRUNCATE target`);
        const restart = t.hasId ? "RESTART IDENTITY" : "";
        await dst.unsafe(`TRUNCATE TABLE ${qIdent(t.name)} ${restart} CASCADE`);
      }

      if (srcCount === 0) {
        console.log(`[${t.name}] (empty, skipping)`);
        continue;
      }

      const colList = t.cols.map(qIdent).join(", ");
      const orderBy = t.hasId
        ? `ORDER BY id`
        : `ORDER BY ${t.cols.map(qIdent).join(", ")}`;

      let copied = 0;
      for (let offset = 0; offset < srcCount; offset += BATCH_SIZE) {
        const rows = await src.unsafe(
          `SELECT ${colList} FROM ${qIdent(t.name)} ${orderBy} LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
        );
        if (rows.length === 0) break;

        // Build a multi-row INSERT
        const placeholders = [];
        const params = [];
        let p = 1;
        for (const row of rows) {
          const ph = t.cols.map(() => `$${p++}`);
          placeholders.push(`(${ph.join(", ")})`);
          for (const c of t.cols) params.push(row[c]);
        }
        const insertSql = `INSERT INTO ${qIdent(t.name)} (${colList}) VALUES ${placeholders.join(", ")}`;
        await dst.unsafe(insertSql, params);

        copied += rows.length;
        process.stdout.write(`\r[${t.name}] copied ${copied} / ${srcCount}`);
      }
      process.stdout.write("\n");

      // Reset id sequence on tables with bigserial id
      if (t.hasId) {
        await dst.unsafe(
          `SELECT setval(
             pg_get_serial_sequence($1, 'id'),
             COALESCE((SELECT MAX(id) FROM ${qIdent(t.name)}), 1)
           )`,
          [t.name],
        );
      }

      // Verify count
      const dstRows = await dst.unsafe(`SELECT count(*)::int AS cnt FROM ${qIdent(t.name)}`);
      const dstCount = dstRows[0].cnt;
      if (dstCount !== srcCount) {
        throw new Error(`[${t.name}] count mismatch: source=${srcCount} target=${dstCount}`);
      }
      console.log(`[${t.name}] ✓ ${dstCount} rows verified`);
      totalCopied += dstCount;
    }

    console.log(
      `\n${dryRun ? "Dry-run complete." : `Migration complete. ${totalCopied} rows copied across ${TABLES.length} tables.`}`,
    );
  } finally {
    await src.end();
    await dst.end();
  }
}

// Quote a SQL identifier (table or column name). Reject anything that isn't a
// plain snake_case identifier so we never end up with injected SQL even though
// these names come from a constant in this file.
function qIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Refusing to quote suspicious identifier: ${name}`);
  }
  return `"${name}"`;
}

function maskUrl(url) {
  return url.replace(/:[^:@/]+@/, ":***@");
}
