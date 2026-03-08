import { configureStore } from '@reduxjs/toolkit';
import accountingReducer from './accountingSlice';

export const store = configureStore({
  reducer: {
    accounting: accountingReducer,
  },
});
