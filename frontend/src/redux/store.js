import { configureStore } from '@reduxjs/toolkit';
import pollSlice from './slices/pollSlice';

export const store = configureStore({
    reducer: {
        poll: pollSlice,
    },
});
