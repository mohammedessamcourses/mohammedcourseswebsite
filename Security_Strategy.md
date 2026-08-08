# Course Content Security Strategy

Protecting digital content is an ongoing battle. While no system is 100% foolproof against determined actors (e.g., someone taking a photo of their physical screen), you can implement several layers to significantly deter sharing and piracy.

## 1. Video Hosting (Most Important)
Currently, you are using **YouTube Unlisted**. This is the least secure method because:
- The link can be shared.
- Standard browser extensions can easily download YouTube videos.
- "Unlisted" simply means it's not searchable, but the direct link gives full access.

### Recommendation: Switch to Bunny.net or Vimeo Pro
- **Bunny.net (Stream)**: Extremely affordable (~$1/month for many users). It offers **Media DRM** and **Domain Locking** (the video will only play on your website).
- **Vimeo Pro/Business**: Offers domain-restricted embedding and higher security levels.

## 2. Infrastructure Layer
- **CloudFront/Signed URLs**: If you host files (PDFs, Source Code) in object storage, use **Signed URLs** that expire after 1 hour. This prevents people from sharing a direct download link.
- **Middleware-based Access**: Ensure your API routes (`/api/sections/[id]`) always verify that the `userId` has `unlockedCourses` containing the relevant course ID before serving content.

## 3. UI Layer (Added in current update)
- **Watermarking**: I have implemented a subtle watermark with the user's name/email. This deters screen recording as their identity is exposed.
- **Copy Protection**: I have disabled right-click and text selection on course content.
- **Security Disclaimers**: Adding prominent warnings (already present in `CourseView`) that access is monitored.

## 4. Advanced Deterrents (Future)
- **Rate Limiting**: Block a user if they access too many sections in a very short time (signature of a scraper).
- **IP Monitoring**: Track if a single account is logged in from 5 different cities in one day.

> [!TIP]
> **Priority #1**: Move your videos to **Bunny.net Stream**. It is the single most effective way to prevent link sharing and video theft for self-hosted course platforms.
