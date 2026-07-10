import { initializeApp, getApps } from 'firebase/app'

const firebaseConfig = {
  apiKey:            'AIzaSyBUf3C_YpQEH-0x_lEwq4jSBlaJ98a_O9Y',
  authDomain:        'sanpc-dms.firebaseapp.com',
  projectId:         'sanpc-dms',
  storageBucket:     'sanpc-dms.firebasestorage.app',
  messagingSenderId: '1015615331893',
  appId:             '1:1015615331893:web:bebff605d6133244f31b7c',
  measurementId:     'G-TJ73J89NH5',
}

export const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
