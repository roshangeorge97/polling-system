import { createSlice } from '@reduxjs/toolkit';

const pollSlice = createSlice({
    name: 'poll',
    initialState: {
        currentPoll: null,
        results: {},
    },
    reducers: {
        setPoll(state, action) {
            state.currentPoll = action.payload;
        },
        updateResults(state, action) {
            state.results = action.payload;
        },
        clearPoll(state) {
            state.currentPoll = null;
            state.results = {};
        },
    },
});

export const { setPoll, updateResults, clearPoll } = pollSlice.actions;
export default pollSlice.reducer;
