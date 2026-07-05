"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onShareDelete = exports.onShareCreate = exports.onRepostDelete = exports.onRepostCreate = exports.onViewCreate = exports.onCommentDelete = exports.onCommentCreate = exports.onSaveDelete = exports.onSaveCreate = exports.onLikeDelete = exports.onLikeCreate = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
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
