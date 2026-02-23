import * as admin from "firebase-admin";
import { getAuth, signInWithCustomToken } from "firebase/auth";

export const mockCreateUser: () => Promise<{
  uid: string;
  jwt?: string;
}> = async () => {
  const userRecord = await admin.auth().createUser({
    email: `${Math.random().toString(36).substring(7)}@test.com`,
    password: "testPassword123",
    displayName: "Mock User",
  });
  const uid = userRecord.uid;

  const customToken = await admin.auth().createCustomToken(uid);

  const jwt = await getIdTokenForCustomToken(customToken);

  await mockAwaitForUserCreationOnFirestore(uid);

  return { uid, jwt };
};
  
export const getIdTokenForCustomToken = async (
  customToken: string,
): Promise<string | undefined> => {
  const auth = getAuth();
  await signInWithCustomToken(auth, customToken);
  return auth.currentUser?.getIdToken();
};

const mockAwaitForUserCreationOnFirestore = async (
  uid: string,
): Promise<void> => {
  return await new Promise<void>((resolve) => {
    const unsubscribe = admin
      .firestore()
      .collection("usuarios")
      .doc(uid)
      .onSnapshot((snapshot) => {
        if (snapshot.exists) {
          unsubscribe();
          resolve();
        }
      });
  });
};

