// sync-football.js - Fetch Barcelona match data and save to Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BARCELONA_ID = 81;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchMatches() {
    console.log('⚽ Fetching Barcelona match data...');

    // Get next scheduled match
    const nextResponse = await fetch(
        `https://api.football-data.org/v4/teams/${BARCELONA_ID}/matches?status=SCHEDULED&limit=1`,
        { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );
    const nextData = await nextResponse.json();

    // Get last finished match
    const lastResponse = await fetch(
        `https://api.football-data.org/v4/teams/${BARCELONA_ID}/matches?status=FINISHED&limit=1`,
        { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );
    const lastData = await lastResponse.json();

    const nextMatch = nextData.matches?.[0];
    const lastMatch = lastData.matches?.[0];

    if (nextMatch) {
        console.log(`📅 Next: ${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}`);
    }
    if (lastMatch) {
        console.log(`✅ Last: ${lastMatch.homeTeam.name} ${lastMatch.score.fullTime.home} - ${lastMatch.score.fullTime.away} ${lastMatch.awayTeam.name}`);
    }

    return { nextMatch, lastMatch };
}

async function saveToSupabase(nextMatch, lastMatch) {
    console.log('💾 Saving to Supabase...');

    // Determine if Barcelona is home or away
    const isNextHome = nextMatch?.homeTeam.id === BARCELONA_ID;
    const isLastHome = lastMatch?.homeTeam.id === BARCELONA_ID;

    // Calculate result for last match
    let lastResult = null;
    if (lastMatch) {
        const barcaGoals = isLastHome ? lastMatch.score.fullTime.home : lastMatch.score.fullTime.away;
        const oppGoals = isLastHome ? lastMatch.score.fullTime.away : lastMatch.score.fullTime.home;
        if (barcaGoals > oppGoals) lastResult = 'WIN';
        else if (barcaGoals < oppGoals) lastResult = 'LOSS';
        else lastResult = 'DRAW';
    }

    const matchData = {
        team_id: BARCELONA_ID,

        // Next match
        next_opponent: nextMatch ? (isNextHome ? nextMatch.awayTeam.name : nextMatch.homeTeam.name) : null,
        next_home_or_away: nextMatch ? (isNextHome ? 'HOME' : 'AWAY') : null,
        next_match_date: nextMatch?.utcDate || null,
        next_competition: nextMatch?.competition.name || null,

        // Last match
        last_opponent: lastMatch ? (isLastHome ? lastMatch.awayTeam.name : lastMatch.homeTeam.name) : null,
        last_home_or_away: lastMatch ? (isLastHome ? 'HOME' : 'AWAY') : null,
        last_match_date: lastMatch?.utcDate || null,
        last_competition: lastMatch?.competition.name || null,
        last_score_home: lastMatch?.score.fullTime.home || null,
        last_score_away: lastMatch?.score.fullTime.away || null,
        last_result: lastResult,

        updated_at: new Date().toISOString()
    };

    // Delete old data and insert new
    await supabase.from('match_data').delete().eq('team_id', BARCELONA_ID);
    const { error } = await supabase.from('match_data').insert(matchData);

    if (error) {
        console.error('❌ Error saving:', error.message);
    } else {
        console.log('✅ Match data saved!');
    }
}

async function main() {
    console.log('='.repeat(50));
    console.log('🔵🔴 Barcelona Match Sync');
    console.log('='.repeat(50));

    const { nextMatch, lastMatch } = await fetchMatches();
    await saveToSupabase(nextMatch, lastMatch);

    console.log('='.repeat(50));
    console.log('🎉 Sync complete!');
    console.log('='.repeat(50));
}

main();
