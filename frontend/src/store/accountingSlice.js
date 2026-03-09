import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../api/axios';

// Basic Thunk to fetch Trial Balance data
export const fetchTrialBalance = createAsyncThunk(
  'accounting/fetchTrialBalance',
  async () => {
    const response = await axios.get('/api/trial-balance');
    return response.data;
  }
);

export const accountingSlice = createSlice({
  name: 'accounting',
  initialState: {
    trialBalanceData: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrialBalance.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTrialBalance.fulfilled, (state, action) => {
        state.loading = false;
        state.trialBalanceData = action.payload;
      })
      .addCase(fetchTrialBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default accountingSlice.reducer;
