import { supabase } from '../supabaseClient';

const TEAM_NAMES = [
    'Los Tigres', 'Águilas Reales', 'Lobos Plateados', 'Toros FC',
    'Guerreros de la Cancha', 'Dragones Rojos', 'Panteras Negras',
    'Tiburones Azules', 'Leones Dorados', 'Rayados del Norte',
    'Atlético San Miguel', 'Deportivo Estrellas', 'Huracanes FC',
    'Espartanos', 'Vikingos', 'Halcones', 'Pumas', 'Bravos'
];

const FIRST_NAMES = [
    'Juan', 'José', 'Miguel', 'Carlos', 'Luis', 'Pedro', 'Pablo',
    'Jorge', 'Fernando', 'Ricardo', 'Daniel', 'David', 'Eduardo',
    'Francisco', 'Javier', 'Alejandro', 'Manuel', 'Roberto', 'Gabriel'
];

const LAST_NAMES = [
    'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez',
    'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Hernández',
    'Ruiz', 'Torres', 'Vargas', 'Reyes', 'Morales', 'Jiménez'
];

const POSITIONS = ['Portero', 'Defensa', 'Medio', 'Delantero'];

export const seedLeague = async (leagueId: string, count: number = 10) => {
    try {

        // Shuffle team names to get random selection
        const availableNames = [...TEAM_NAMES].sort(() => 0.5 - Math.random());

        for (let i = 0; i < Math.min(count, availableNames.length); i++) {
            const name = availableNames[i];

            // 1. Insert Team
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert({
                    league_id: leagueId,
                    name: name,
                    // Optional: Random shield colors or urls if we had them
                })
                .select()
                .single();

            if (teamError) throw teamError;
            if (!teamData) continue;

            const teamId = teamData.id;
            const playersToInsert = [];

            // 2. Generate 11-15 players per team
            const playerCount = 11 + Math.floor(Math.random() * 5);
            for (let j = 0; j < playerCount; j++) {
                const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
                const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
                const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

                playersToInsert.push({
                    team_id: teamId,
                    name: `${firstName} ${lastName}`,
                    number: Math.floor(Math.random() * 99) + 1,
                    position: position,
                    is_captain: j === 0 // Make the first one captain
                });
            }

            // 3. Bulk Insert Players
            const { error: playersError } = await supabase
                .from('players')
                .insert(playersToInsert);

            if (playersError) console.error(`Error inserting players for ${name}`, playersError);
        }

        return { success: true };

    } catch (error) {
        console.error("Seeding error:", error);
        return { success: false, error };
    }
};
