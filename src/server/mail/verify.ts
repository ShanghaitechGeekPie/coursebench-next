import Redis from "ioredis";
import { randomUUID } from "crypto";
import { sendMail } from "./send";

const redis = new Redis(process.env.REDIS_URL!);

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
const SERVICE_NAME = process.env.SERVICE_NAME || "GeekPie_ CourseBench 评教平台";
const SERVICE_NAME_EN = process.env.SERVICE_NAME_EN || "GeekPie_ CourseBench";
const CODE_TTL = 60 * 60 * 2; // 2 hours in seconds

/**
 * Generate a verification code, store it in Redis, and send the email.
 * Mirrors the Go PostMail function.
 */
export async function postMail(
  userId: number,
  email: string,
  service: string,
  subject: string,
  urlPath: string,
  body: string,
): Promise<void> {
  if (process.env.DISABLE_MAIL === "true") return;

  const code = randomUUID();
  const key = `${service}:${userId}`;
  await redis.set(key, code, "EX", CODE_TTL);

  const activeURL = `${SERVER_URL}/${urlPath}?id=${userId}&code=${code}`;
  await sendMail(email, subject, body, activeURL);
}

/**
 * Verify a mail code against what's stored in Redis.
 * Returns true if valid, false if mismatch. Deletes the code on success.
 */
export async function checkCode(userId: number, code: string, service: string): Promise<boolean> {
  if (process.env.DISABLE_MAIL === "true") return true;

  const key = `${service}:${userId}`;
  const stored = await redis.get(key);

  if (!stored) return false;
  if (stored !== code) return false;

  await redis.del(key);
  return true;
}

// Re-export email templates
export function getRegisterEmailBody(): string {
  return `<html><body>
<h1>欢迎注册${SERVICE_NAME}</h1>
<p>我们已经接收到您的电子邮箱验证申请，请点击以下链接完成注册。</p>
<p>验证完成后，您将能够即刻发布课程评价，并与其他用户互动。</p>
<p>请手动复制该链接并粘贴至浏览器地址栏以完成注册：</p>
<br/>
<p>{activeURL}</p>
<br/>
<p>预祝您在 CourseBench 玩得开心！</p>
<br/>
<p>如果您需要其它任何帮助，欢迎随时联系我们。</p>
<p>电邮地址：geekpie@geekpie.club</p>
<p>如您并未注册CourseBench账号，请无视本邮件。</p>
<br/>
<p>此致</p>
<p>${SERVICE_NAME} 团队</p>
<br>
<h1>Thank you for registering for ${SERVICE_NAME_EN}</h1> <p>We have received your application for verifying this email address. Please click on the link below to accomplish the process.</p>
<p>Once the registration is done, you will be able to post your comments on courses and interact with other users.</p>
<p>Please copy this URL and paste it on the address bar of your browser: </p>
<br/>
<p>{activeURL}</p>
<br/>
<p>Have fun at CourseBench!</p>
<br/>
<p>If you need any help, please don't hesitate to contact us.</p>
<p>Email: geekpie@geekpie.club </p>
<p>If you are not registering for CourseBench, please ignore this email.</p>
<br/>
<p>Yours,</p>
<p>${SERVICE_NAME_EN} Team</p>
</body></html>`;
}

export function getResetPasswordEmailBody(): string {
  return `<html><body>
<h1>您正在重置您在${SERVICE_NAME}的密码</h1>
<p>请手动复制该链接并粘贴至浏览器：</p>
<br/>
<p>{activeURL}</p>
<br/>
<p>如有任何疑问，请随时联系我们。</p>
<p>电邮地址：geekpie@geekpie.club</p>
<p>如果您没有注册过我们的服务或您没有进行过密码重置，请无视该邮件</p>
<br/>
<p>此致</p>
<p>${SERVICE_NAME} 团队</p>
<br/>
<h1>You are resetting your password for ${SERVICE_NAME_EN}</h1>
<p>Please copy this URL and paste it on the address bar of your browser: </p>
<br/>
<p>{activeURL}</p>
<br/>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Email: geekpie@geekpie.club</p>
<p>If you did not register for our service or did not request a password reset, please ignore this email.</p>
<br/>
<p>Yours,</p>
<p>${SERVICE_NAME_EN} Team</p>
</body></html>`;
}
