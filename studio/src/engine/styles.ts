export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  bgTop: string;
  bgBottom: string;
  primary: string;
  secondary: string;
  accent: string;
  warm: string;
  text: string;
  textDim: string;
  /** multiplicador del brillo aditivo */
  glow: number;
  grain: number;
  vignette: number;
  scanlines: boolean;
}

export const STYLES: VisualStyle[] = [
  {
    id: 'neon',
    name: 'Neón cinematográfico',
    description: 'Azules eléctricos sobre negro, brillo intenso',
    bgTop: '#03060f', bgBottom: '#000104',
    primary: '#3d8bff', secondary: '#5ff2ff', accent: '#ffb347', warm: '#ff5f8f',
    text: '#f2f7ff', textDim: '#9db3d6',
    glow: 1.15, grain: 0.06, vignette: 0.75, scanlines: false,
  },
  {
    id: 'clinico',
    name: 'Clínico',
    description: 'Sobrio, tonos pizarra y turquesa, poco brillo',
    bgTop: '#0b1119', bgBottom: '#04070b',
    primary: '#6fa8c9', secondary: '#9fe3d8', accent: '#f2c46d', warm: '#e8857a',
    text: '#eef3f6', textDim: '#a7b6c2',
    glow: 0.75, grain: 0.03, vignette: 0.5, scanlines: false,
  },
  {
    id: 'calido',
    name: 'Cálido emocional',
    description: 'Magentas y ámbar para temas afectivos',
    bgTop: '#0d0410', bgBottom: '#020003',
    primary: '#b45cff', secondary: '#ff7ac8', accent: '#ffb347', warm: '#ff4f7b',
    text: '#fff3f8', textDim: '#d6a9c4',
    glow: 1.2, grain: 0.07, vignette: 0.8, scanlines: false,
  },
  {
    id: 'holograma',
    name: 'Holograma',
    description: 'Verde-cian técnico con líneas de escaneo',
    bgTop: '#010d0c', bgBottom: '#000403',
    primary: '#1fd1a5', secondary: '#7dffe9', accent: '#e9ff70', warm: '#ff9f5a',
    text: '#e9fff9', textDim: '#8fd1c0',
    glow: 1.0, grain: 0.05, vignette: 0.7, scanlines: true,
  },
];

export const getStyle = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0];
