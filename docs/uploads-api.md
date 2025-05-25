# File Upload API

This document describes the File Upload API for the e-voting system, which allows clients to upload images for elections and candidates.

## Overview

The File Upload API provides endpoints for uploading and retrieving files, primarily used for election images and candidate profile pictures.

## Base URL

All URLs referenced in this document have the following base:

```
/api/v1/uploads
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Upload a File

Used to upload images for elections or candidates.

**URL**: `/api/v1/uploads`

**Method**: `POST`

**Auth Required**: Yes

**Content-Type**: `multipart/form-data`

**Form Fields**:

- `file` - The file to upload (image)

**Success Response**:

- **Code**: 200 OK
- **Content**:

  ```json
  {
    "filename": "1748205994259-election-image.jpg",
    "url": "/uploads/1748205994259-election-image.jpg"
  }
  ```

**Error Responses**:

- **Code**: 400 Bad Request (No file)
- **Content**:

  ```json
  {
    "error": "No file uploaded or invalid file type"
  }
  ```

- **Code**: 400 Bad Request (File too large)
- **Content**:

  ```json
  {
    "error": "File size exceeds limit (10MB)"
  }
  ```

- **Code**: 400 Bad Request (Invalid file type)
- **Content**:

  ```json
  {
    "error": "Upload error: Only image files are allowed!"
  }
  ```

### Download or Display a File

Retrieves a previously uploaded file, either as a download or for direct display in the browser.

**URL**: `/uploads/:filename`

**Method**: `GET`

**Auth Required**: No

**URL Parameters**:
- `filename` - The name of the file to download

**Query Parameters**:
- `display` - Set to `true` to serve the file for browser display instead of download

**Success Response**:

- **Code**: 200 OK
- **Content**: The requested file

**Error Response**:

- **Code**: 404 Not Found
- **Content**:
  ```json
  {
    "error": "File not found"
  }
  ```

## Usage with Elections API

When creating or updating elections, you should first upload any images using this API, then include the returned URL in your election request.

### Example: Create an Election with an Image

1. First, upload the election image:

   ```javascript
   // Upload the election image
   const imageFormData = new FormData();
   imageFormData.append('file', imageFile);

   const imageResponse = await fetch('/uploads', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer <token>'
     },
     body: imageFormData
   });

   const imageData = await imageResponse.json();
   const imageUrl = imageData.url;  // e.g., "/uploads/1748205994259-election-image.jpg"
   ```

2. Then create the election using the image URL:

   ```javascript
   const electionData = {
     name: "Presidential Election 2025",
     description: "National election for selecting the president",
     candidates: [
       {
         name: "Jane Smith",
         party: "Progressive Party",
         profile_image: "/uploads/1748205994259-candidate1.jpg" // Another uploaded image
       },
       {
         name: "John Doe",
         party: "Conservative Party",
         profile_image: "/uploads/1748205994260-candidate2.jpg" // Another uploaded image
       }
     ],
     start_time: "2025-06-01T08:00:00Z",
     end_time: "2025-06-01T20:00:00Z",
     eligible_governorates: ["Cairo", "Alexandria", "Giza"],
     election_image: imageUrl // Use the uploaded image URL here
   };

   const response = await fetch('/elections', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer <token>',
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(electionData)
   });
   ```

## File Storage

Files are stored in the `./uploads/` directory on the server. The file URL returned by the API is a relative path that should be appended to your API base URL when displaying images in the frontend.

## Best Practices

1. **Relative URLs**: The API returns relative URLs (e.g., `/uploads/filename.jpg`) rather than absolute URLs. When displaying images in the frontend, append these paths to your base API URL.

2. **Image Optimization**: Consider optimizing images before uploading for better performance.

3. **Error Handling**: Always handle upload errors gracefully in the frontend, providing feedback to the user.

## Limitations

- Maximum file size: 10MB
- Supported file types: Images only (JPG, JPEG, PNG, GIF, WebP, etc.)
- No automatic image resizing or optimization is performed

## Security Considerations

1. **Authorization**: Only authenticated users should be allowed to upload files.

2. **File Type Validation**: Server performs validation to ensure only image files are accepted.

3. **File Size Limits**: Maximum upload size is restricted to prevent abuse.

4. **Front-end Validation**: Implement additional client-side validation to improve user experience.
