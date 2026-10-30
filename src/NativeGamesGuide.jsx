import React, {useState} from 'react';
import {Gamepad2, Search} from 'lucide-react';

// Read from /ext/apps/Games on the user's Momentum device, 2026-10-29.
// File presence is an inventory observation, not a successful launch test.
const installed = [
  ['4inrow','4 in a Row'], ['air_arkanoid','Air Arkanoid'], ['air_labyrinth','Air Labyrinth'],
  ['arkanoid','Arkanoid'], ['asteroids','Asteroids'], ['blackjack','Blackjack'],
  ['bomberduck','Bomberduck'], ['checkers','Checkers'], ['chess','Chess'],
  ['color_guess','Color Guess'], ['doom','Doom'], ['flappy_bird','Flappy Bird'],
  ['flipper_pong','Flipper Pong'], ['game15','15 Puzzle'], ['game_2048','2048'],
  ['gameoflife','Game of Life'], ['geometry_dash','Geometry Dash'], ['heap_defence','Heap Defence'],
  ['jetpack_joyride','Jetpack Joyride'], ['laser_tag','Laser Tag'], ['minesweeper_redux','Minesweeper Redux'],
  ['multi_dice','Multi Dice'], ['pinball0','Pinball0'], ['quadrastic','Quadrastic'],
  ['reversi','Reversi'], ['roots_of_life','Roots of Life'], ['rubiks_cube_scrambler','Rubik’s Cube Scrambler'],
  ['scorched_tanks','Scorched Tanks'], ['simon_says','Simon Says'], ['slotmachine','Slot Machine'],
  ['snake20','Snake 2.0'], ['solitaire','Solitaire'], ['t_rex_runner','T-Rex Runner'],
  ['tama_p1','Tama P1'], ['tanks','Tanks'], ['tetris','Tetris'],
  ['tictactoe','Tic Tac Toe'], ['umpire_indicator','Umpire Indicator'], ['videopoker','Video Poker'],
  ['yapinvaders','Yap Invaders'], ['yatzee','Yatzee'], ['zombiez','Zombiez'],
];
const quickStarts = [
  {name:'T-Rex Runner', file:'t_rex_runner', goal:'Salta los cactus y aguanta el mayor tiempo posible.', steps:['En Apps → Games, selecciona T-Rex Runner y pulsa OK para abrirlo.', 'Durante la carrera, pulsa OK para saltar cuando se acerque un cactus.', 'Tras perder, pulsa OK para reiniciar. Back sale del juego.'], source:'t_rex_runner/trexrunner.c'},
  {name:'Flappy Bird', file:'flappy_bird', goal:'Pasa entre los obstáculos manteniendo al pájaro en el aire.', steps:['En Apps → Games, abre Flappy Bird.', 'En su pantalla de inicio, pulsa OK para comenzar.', 'Durante la partida, pulsa ↑ para aletear. Ajusta el ritmo para pasar por los huecos. Back permite salir.'], source:'flappy_bird/flappy_bird.c'},
  {name:'Tetris', file:'tetris', goal:'Completa filas con las piezas que caen para despejar el tablero.', steps:['En Apps → Games, abre Tetris. Si aparece la pantalla de fin, OK inicia otra partida.', 'Usa ← y → para mover la pieza; OK la gira y ↑ activa la caída rápida.', 'Una pulsación corta de Back pausa o reanuda. Mantén Back para salir.'], source:'tetris/tetris_game.c'},
];

export default function NativeGamesGuide() {
  const [query, setQuery] = useState('');
  const matches = installed.filter(([file, name]) => `${file} ${name}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="native-games-guide">
    <div className="games-intro"><span className="games-emblem"><Gamepad2 size={34}/></span><div><span className="section-index">LA PANTALLA Y LOS BOTONES DEL FLIPPER</span><h2>Tu consola de bolsillo.</h2><p>Abre Apps → Games y elige un juego para jugar directamente en el dispositivo.</p></div><span className="badge">{installed.length} archivos encontrados</span></div>
    <section className="panel"><div className="panel-heading"><span className="section-index">EMPIEZA AQUÍ</span><h2>De Apps a tu primera partida.</h2></div><div className="panel-body native-start">
      <ol><li>En el Flipper, vuelve al menú y selecciona <strong>Apps</strong>.</li><li>Entra en <strong>Games</strong> para ver tu colección.</li><li>Recorre los títulos con <strong>↑ / ↓</strong> y pulsa <strong>OK</strong> sobre el que quieras abrir.</li><li>Sigue las instrucciones del juego. Usa sus botones de movimiento y acción; consulta su ayuda si está disponible.</li></ol>
      <div className="note"><Gamepad2 size={20}/><p>Estos juegos se ven en la pantalla del Flipper. Remote y la asignación de botón se usan para Flipper Run en el computador. Para jugar aquí, sal de Remote y abre Apps → Games.</p></div>
    </div></section>
    <div className="native-heading"><span className="section-index">TRES PARTIDAS PARA EMPEZAR</span><h2>Elige tu primer reto.</h2><p>Controles consultados en el código público de Momentum. Pueden variar con la versión instalada; sigue la pantalla del juego si difiere.</p></div>
    <div className="native-game-cards">{quickStarts.map(game => <article className="panel" key={game.file}><div className="panel-heading"><span className="badge green">Archivo encontrado</span><h3>{game.name}</h3><p>{game.goal}</p></div><div className="panel-body"><ol>{game.steps.map(step => <li key={step}>{step}</li>)}</ol><a href={`https://github.com/Next-Flip/Momentum-Apps/blob/dev/${game.source}`} target="_blank" rel="noreferrer">Consultar controles ↗</a></div></article>)}</div>
    <section className="panel native-inventory"><div className="panel-heading"><span className="section-index">TU COLECCIÓN</span><h2>Lo que encontramos en Games.</h2></div><div className="panel-body">
      <label className="native-search"><Search size={18}/><span className="native-search-label">Buscar en la colección</span><input aria-label="Buscar juegos del Flipper" placeholder="Nombre del juego o archivo…" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <p className="games-session-note" role="status">{matches.length} de {installed.length} archivos</p>
      <ul className="native-file-list">{matches.map(([file, name]) => <li key={file}><strong>{name}</strong><code>{file}.fap</code></li>)}</ul>
      {!matches.length && <p>No hay coincidencias. Prueba otro nombre.</p>}
      <p className="games-session-note">Los nombres son etiquetas de lectura basadas en los archivos y pueden diferir del menú. La carpeta también incluye utilidades. Algunos títulos necesitan accesorios o datos adicionales; revisa las indicaciones de cada aplicación.</p>
    </div></section>
  </div>;
}
