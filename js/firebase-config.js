window.W = window.W || {};

/* ===================================================================
   請把 Venus OS 裡那一份 firebaseConfig 原封不動貼進來（同一個專案
   attendance-pwa-9fa73），欄位不要自己重打，直接從既有程式碼複製。

   沒填也不會壞：雲端功能會自動關閉，遊戲照常用本機存檔運作，
   診斷面板會顯示「雲端：未設定」。
   =================================================================== */
W.FIREBASE_CONFIG = null;

/* 填好之後長這樣（把 null 換成整個物件）：

W.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "attendance-pwa-9fa73.firebaseapp.com",
  projectId: "attendance-pwa-9fa73",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

*/
