"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signCloudinaryUpload = exports.onShareDelete = exports.onShareCreate = exports.onRepostDelete = exports.onRepostCreate = exports.onViewCreate = exports.onCommentDelete = exports.onCommentCreate = exports.onSaveDelete = exports.onSaveCreate = exports.onLikeDelete = exports.onLikeCreate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const crypto = __importStar(require("crypto"));
const CLOUDINARY_API_SECRET = (0, params_1.defineSecret)('CLOUDINARY_API_SECRET');
const CLOUDINARY_API_KEY = (0, params_1.defineSecret)('CLOUDINARY_API_KEY');
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const bump = (path, field, delta) => db.doc(path).update({ [field]: firestore_2.FieldValue.increment(delta) }).catch((e) => {
    console.warn(`bump ${field} ${delta} on ${path} failed:`, e?.message ?? e);
});
/* ---------- LIKES : videos/{videoId}/likes/{userId} ---------- */
exports.onLikeCreate = (0, firestore_1.onDocumentCreated)('videos/{videoId}/likes/{userId}', (e) => bump(`videos/${e.params.videoId}`, 'likes', 1));
exports.onLikeDelete = (0, firestore_1.onDocumentDeleted)('videos/{videoId}/likes/{userId}', (e) => bump(`videos/${e.params.videoId}`, 'likes', -1));
/* ---------- SAVES : videos/{videoId}/saves/{userId} ---------- */
exports.onSaveCreate = (0, firestore_1.onDocumentCreated)('videos/{videoId}/saves/{userId}', (e) => bump(`videos/${e.params.videoId}`, 'saves', 1));
exports.onSaveDelete = (0, firestore_1.onDocumentDeleted)('videos/{videoId}/saves/{userId}', (e) => bump(`videos/${e.params.videoId}`, 'saves', -1));
/* ---------- COMMENTS : videos/{videoId}/comments/{commentId} ---------- */
exports.onCommentCreate = (0, firestore_1.onDocumentCreated)('videos/{videoId}/comments/{commentId}', (e) => bump(`videos/${e.params.videoId}`, 'comments', 1));
exports.onCommentDelete = (0, firestore_1.onDocumentDeleted)('videos/{videoId}/comments/{commentId}', (e) => bump(`videos/${e.params.videoId}`, 'comments', -1));
/* ---------- VIEWS : videos/{videoId}/views/{userId} (une par user) ---------- */
exports.onViewCreate = (0, firestore_1.onDocumentCreated)('videos/{videoId}/views/{userId}', (e) => bump(`videos/${e.params.videoId}`, 'views', 1));
/* ---------- REPOSTS : collection top-level reposts, champ postId ---------- */
exports.onRepostCreate = (0, firestore_1.onDocumentCreated)('reposts/{repostId}', (e) => {
    const videoId = e.data?.get('postId');
    return videoId ? bump(`videos/${videoId}`, 'reposts', 1) : null;
});
exports.onRepostDelete = (0, firestore_1.onDocumentDeleted)('reposts/{repostId}', (e) => {
    const videoId = e.data?.get('postId');
    return videoId ? bump(`videos/${videoId}`, 'reposts', -1) : null;
});
/* ---------- SHARES : collection top-level shares, champ postId ---------- */
exports.onShareCreate = (0, firestore_1.onDocumentCreated)('shares/{shareId}', (e) => {
    const videoId = e.data?.get('postId');
    return videoId ? bump(`videos/${videoId}`, 'shares', 1) : null;
});
exports.onShareDelete = (0, firestore_1.onDocumentDeleted)('shares/{shareId}', (e) => {
    const videoId = e.data?.get('postId');
    return videoId ? bump(`videos/${videoId}`, 'shares', -1) : null;
});
/* ---------- CLOUDINARY SIGNATURE : callable ---------- */
exports.signCloudinaryUpload = (0, https_1.onCall)({ secrets: [CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = request.auth.uid;
    const resourceType = request.data?.resourceType === 'video' ? 'video' : 'image';
    const folder = resourceType === 'video' ? `reels/${uid}` : `profile/${uid}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const apiSecret = CLOUDINARY_API_SECRET.value();
    const apiKey = CLOUDINARY_API_KEY.value();
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha256').update(toSign).digest('hex');
    return { signature, timestamp, folder, apiKey };
});
