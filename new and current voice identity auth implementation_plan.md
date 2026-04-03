# Voice Identity Authentication (Voice Login) Implementation Plan

This plan outlines the steps required to implement Voice Identity as a login option. This involves extending the Python AI engine for speaker verification, adding a new authentication flow in the Node.js backend, and creating a dedicated voice-based login UI.

## User Review Required

> [!IMPORTANT]
> **Security Considerations**: Voice authentication will initially use a simple similarity threshold. For production-grade security, we should eventually implement "Challenge-Response" (asking the user to speak a specific random phrase) to prevent replay attacks.
> 
> **Prerequisites**: Users must have already "Enrolled" their voice in the Settings page for this feature to work.

## Proposed Changes

### 1. Speaker Verification (AI Engine - Python)

#### [MODIFY] [api.py](file:///c:/new%20code/FaceSearchProject/api.py)
- **New Endpoint**: `POST /audio/verify`
- **Pillar 1 Implementation**:
    1. Accept `user_id` and `reference_audio`.
    2. Load the stored `speaker_embedding.npy` for the user.
    3. Extract the embedding from the new "live" audio.
    4. Calculate **Cosine Similarity**.
    5. Return `verified: true` if similarity > threshold (e.g. 0.8).

### 2. Challenge-Response (Security Pillar)

#### [NEW] Challenge Generation Mechanism
- **Backend**: Add a query `getVoiceLoginChallenge(email: String!): String!` that returns a random 4-6 digit code or unique phrase.
- **Frontend**: The `VoiceLogin` UI will first fetch this challenge and display it to the user.
- **User Action**: The user must record themselves speaking the specific challenge shown on screen.

### 3. Fallback & MFA Logic (Reliability Pillar)

#### [MODIFY] Login Flow Integration
- **Hybrid Auth**: If Voice Verification fails due to noise or illness, the system will automatically offer:
    1. **Face Identity Fallback**: Seamlessly switch to Face Login.
    2. **MFA Mode**: Allow Voice Login to act as a Second Factor (2FA) for high-security accounts that already entered a password.


---

### 2. Node.js Backend

#### [MODIFY] [voiceCloningService.ts](file:///f:/Code%20i%20really%20need/Super%20AI%20App/src/apps/backend/src/services/voiceCloningService.ts)
- Add a `verifyVoice(userId: string, audio: Upload)` method.
- This method will send the audio to the Python `/audio/verify` endpoint and return the verification result.

#### [MODIFY] [schema.ts](file:///f:/Code%20i%20really%20need/Super%20AI%20App/src/apps/backend/src/schema/schema.ts) & [auth.ts](file:///f:/Code%20i%20really%20need/Super%20AI%20App/src/apps/backend/src/schema/auth.ts)
- Add `loginWithVoice(email: String!, audio: Upload!): AuthPayload!` mutation.
- Add `VoiceVerificationResult` type if needed (or reuse `AuthPayload`).

#### [MODIFY] [resolvers/auth/resolvers.ts](file:///f:/Code%20i%20really%20need/Super%20AI%20App/src/apps/backend/src/resolvers/auth/resolvers.ts)
- **Implement `getVoiceLoginChallenge`**: Simply returns a random string.
- **Implement `loginWithVoice`**:
    1. Find user by email.
    2. Call `voiceCloningService.verifyVoice`.
    3. If similarity is sufficient, generate JWT and return `AuthPayload`.
    4. Link to existing Face Login logic for easy fallback.

---

### 3. React Frontend

#### [NEW] `VoiceLogin.tsx` (in `src/components/auth/`)
- Displays the **Challenge Phrase** (e.g., "7-4-2-9").
- Provides a "Try Face Login instead" fallback button.
- Handles the recording and submission.

#### [MODIFY] `Login.tsx`
- Add a button "Login with Voice Identity" that toggles the view to the new `VoiceLogin` component.

## Open Questions

- **Threshold Tuning**: What is the ideal similarity threshold for "Facenet512" style embeddings in audio? (I'll start with 0.8 and we can tune it).
- **Phrase Requirement**: Should we require a specific phrase (e.g., "Authorize login for Super AI App") to provide a better user experience?

## Verification Plan

### Automated Tests
- Script to send a known "matching" voice sample to `/audio/verify` via the Node.js service.
- Script to send a mismatching voice sample to ensure it fails.

### Manual Verification
- Enroll voice in Settings.
- Logout.
- Attempt "Voice Login" with a live recording.
- Verify that a valid JWT token is returned and the user is logged in.
