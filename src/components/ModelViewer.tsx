import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Box, Check, ChevronRight, Expand, Glasses, Hand, Info, LoaderCircle, Maximize2, MousePointer2, RotateCcw, RotateCw, Volume2, VolumeX, X, ZoomIn, ZoomOut } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Lang, MuseumObject } from '../types';
import './viewer.css';

type Props = { object: MuseumObject; lang: Lang; onClose: () => void; startVR?: boolean };
type Runtime = {
  reset: () => void;
  zoom: (factor: number) => void;
  rotate: (enabled: boolean) => void;
  startXR: () => Promise<void>;
  endXR: () => Promise<void>;
};

const labels = {
  kk: {
    back: 'Музейге оралу', exhibit: 'ИНТЕРАКТИВТІ ЭКСПОНАТ', approximate: 'Көркем 3D реконструкция', loading: 'Модель жүктелуде',
    rotate: 'Автоматты айналдыру', reset: 'Бастапқы көрініс', fullscreen: 'Толық экран', zoomIn: 'Жақындату', zoomOut: 'Алыстату',
    vr: 'VR режимі', orbit: '360° шолу', guide: 'Қазақша аудиогид', stop: 'Аудионы тоқтату', detail: 'ЭКСПОНАТ ТУРАЛЫ',
    drag: 'Айналдыру үшін сүйреңіз', scroll: 'Масштаб үшін айналдырыңыз', touch: 'Екі саусақпен масштабтаңыз', hotspot: 'Белгіні басып, көбірек біліңіз',
    failed: '3D көрініс ашылмады', failedText: 'WebGL қолдайтын браузерде қайта ашып көріңіз немесе интернет байланысын тексеріңіз.', retry: 'Қайта жүктеу',
    fallbackTitle: '360° интерактивті шолу', fallbackText: 'Бұл құрылғыда немесе браузерде иммерсивті WebXR қолжетімсіз. Модельді экранда айналдырып, жақындатып көре аласыз. Бұл VR гарнитура режимі емес.',
    safetyTitle: 'Виртуалды саяхатқа дайынсыз ба?', safetyText: 'Гарнитураны киер алдында айналаңыздағы кеңістікті босатыңыз. Қозғалыссыз не отырып қарауға болады. Өзіңізді жайсыз сезінсеңіз, гарнитураны шешіңіз.',
    safetyControls: 'Контроллерді еденге бағыттап, негізгі батырманы бассаңыз, сол нүктеге өтесіз. Шығу үшін гарнитураның жүйелік мәзірін немесе «VR-дан шығу» батырмасын пайдаланыңыз.',
    enter: 'VR-ға кіру', cancel: 'Кейінірек', exitVR: 'VR-дан шығу', vrActive: 'VR қосылды', vrFailed: 'VR сессиясы басталмады. Гарнитура байланысын және браузер рұқсатын тексеріңіз.',
    subtitles: 'ҚАЗАҚША АУДИОГИД МӘТІНІ', noVoice: 'Бұл браузерде қазақша дауыс орнатылмаған. Экскурсия мәтінін төменде оқи аласыз.',
    soundFailed: 'Дыбыстық ойнату қолжетімсіз. Экскурсия мәтіні төменде көрсетілген.', close: 'Жабу', ready: '3D модель', fullscreenFailed: 'Толық экран режимі бұл браузерде қолжетімсіз.',
  },
  ru: {
    back: 'Вернуться в музей', exhibit: 'ИНТЕРАКТИВНЫЙ ЭКСПОНАТ', approximate: 'Художественная 3D-реконструкция', loading: 'Загружаем модель',
    rotate: 'Автовращение', reset: 'Исходный ракурс', fullscreen: 'На весь экран', zoomIn: 'Приблизить', zoomOut: 'Отдалить',
    vr: 'Режим VR', orbit: 'Обзор 360°', guide: 'Аудиогид на казахском', stop: 'Остановить аудио', detail: 'ОБ ЭКСПОНАТЕ',
    drag: 'Потяните, чтобы повернуть', scroll: 'Прокрутите для масштаба', touch: 'Масштабируйте двумя пальцами', hotspot: 'Нажмите на метку, чтобы узнать больше',
    failed: 'Не удалось открыть 3D', failedText: 'Попробуйте браузер с поддержкой WebGL или проверьте подключение к интернету.', retry: 'Загрузить снова',
    fallbackTitle: 'Интерактивный обзор 360°', fallbackText: 'Иммерсивный WebXR недоступен на этом устройстве или в этом браузере. Вы можете вращать и приближать модель на экране. Это не режим VR-гарнитуры.',
    safetyTitle: 'Готовы к виртуальному путешествию?', safetyText: 'Перед использованием гарнитуры освободите пространство вокруг себя. Можно смотреть сидя или стоя на месте. При дискомфорте снимите гарнитуру.',
    safetyControls: 'Направьте контроллер на пол и нажмите основную кнопку, чтобы переместиться. Для выхода используйте системное меню гарнитуры или кнопку «Выйти из VR».',
    enter: 'Войти в VR', cancel: 'Позже', exitVR: 'Выйти из VR', vrActive: 'VR активен', vrFailed: 'Не удалось начать VR-сеанс. Проверьте подключение гарнитуры и разрешения браузера.',
    subtitles: 'ТЕКСТ АУДИОГИДА НА КАЗАХСКОМ', noVoice: 'В браузере не установлен казахский голос. Текст экскурсии доступен ниже.',
    soundFailed: 'Озвучивание недоступно. Текст экскурсии показан ниже.', close: 'Закрыть', ready: '3D-модель', fullscreenFailed: 'Полноэкранный режим недоступен в этом браузере.',
  },
  en: {
    back: 'Back to museum', exhibit: 'INTERACTIVE EXHIBIT', approximate: 'Approximate AI reconstruction', loading: 'Loading the model',
    rotate: 'Auto rotate', reset: 'Reset view', fullscreen: 'Full screen', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
    vr: 'Enter VR', orbit: '360° view', guide: 'Kazakh audio guide', stop: 'Stop audio', detail: 'ABOUT THE EXHIBIT',
    drag: 'Drag to rotate', scroll: 'Scroll to zoom', touch: 'Pinch to zoom', hotspot: 'Select a marker to discover more',
    failed: 'The 3D view could not load', failedText: 'Try a browser with WebGL support or check your internet connection.', retry: 'Try again',
    fallbackTitle: 'Interactive 360° view', fallbackText: 'Immersive WebXR is unavailable on this device or browser. You can rotate and zoom into the model on screen. This is not a VR headset mode.',
    safetyTitle: 'Ready for a virtual journey?', safetyText: 'Clear the space around you before using your headset. You can explore while seated or standing still. Remove your headset if you feel uncomfortable.',
    safetyControls: 'Point a controller at the floor and press its primary button to teleport. To leave, use the headset system menu or the “Exit VR” button.',
    enter: 'Enter VR', cancel: 'Maybe later', exitVR: 'Exit VR', vrActive: 'VR is active', vrFailed: 'The VR session could not start. Check the headset connection and browser permissions.',
    subtitles: 'KAZAKH AUDIO GUIDE TRANSCRIPT', noVoice: 'A Kazakh voice is not installed in this browser. You can read the guide transcript below.',
    soundFailed: 'Speech playback is unavailable. The guide transcript is shown below.', close: 'Close', ready: '3D model', fullscreenFailed: 'Full-screen mode is unavailable in this browser.',
  },
};

function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((item) => {
    const mesh = item as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export default function ModelViewer({ object, lang, onClose, startVR = false }: Props) {
  const t = labels[lang];
  const hostRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const xrOverlayRef = useRef<HTMLDivElement>(null);
  const hotspotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const runtimeRef = useRef<Runtime | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [hotspot, setHotspot] = useState<number | null>(null);
  const [xrSupport, setXRSupport] = useState({ checked: false, supported: false });
  const [xrActive, setXRActive] = useState(false);
  const [xrStarting, setXRStarting] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [notice, setNotice] = useState('');
  const startVRHandled = useRef(false);
  const transcript = `${object.title.kk}. ${object.description.kk} ${object.hotspots.map((item) => `${item.title.kk}. ${item.description.kk}`).join(' ')}`;

  const close = useCallback(() => {
    void runtimeRef.current?.endXR();
    if (document.fullscreenElement && dialogRef.current?.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => {});
    closeRef.current();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      previousFocus?.focus();
    };
  }, [close]);

  useEffect(() => {
    let alive = true;
    if (navigator.xr && window.isSecureContext) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (alive) setXRSupport({ checked: true, supported });
      }).catch(() => { if (alive) setXRSupport({ checked: true, supported: false }); });
    } else setXRSupport({ checked: true, supported: false });
    const updateVoices = () => setVoiceAvailable('speechSynthesis' in window && window.speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith('kk')));
    updateVoices();
    if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => {
      alive = false;
      if ('speechSynthesis' in window) window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  useEffect(() => {
    if (!startVR || startVRHandled.current || loading || !xrSupport.checked || failed) return;
    startVRHandled.current = true;
    if (xrSupport.supported) setShowSafety(true);
    else setShowFallback(true);
  }, [startVR, loading, xrSupport, failed]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let session: XRSession | null = null;
    let model: THREE.Group | null = null;
    let modelOffset = new THREE.Vector3();
    let fittedDistance = 14;
    let fittedTarget = new THREE.Vector3(0, 2, 0);
    let fittedPosition = new THREE.Vector3(10, 7, 12);
    let modelSize: THREE.Vector3 | null = null;
    setLoading(true);
    setProgress(0);
    setFailed(false);
    setHotspot(null);
    setRotating(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    } catch {
      setFailed(true);
      setLoading(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.domElement.setAttribute('aria-label', object.title[lang]);
    renderer.domElement.setAttribute('role', 'img');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9e7df');
    scene.fog = new THREE.Fog('#e9e7df', 40, 105);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.04, 200);
    const rig = new THREE.Group();
    rig.add(camera);
    scene.add(rig);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.autoRotateSpeed = 0.7;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    const hemisphere = new THREE.HemisphereLight('#fff9ed', '#7f897b', 2.6);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight('#fff6de', 4.2);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.camera.far = 65;
    keyLight.shadow.normalBias = 0.035;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);
    const fill = new THREE.DirectionalLight('#cfdfeb', 1.7);
    fill.position.set(-10, 8, -7);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: '#e7e3d8', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    floor.receiveShadow = true;
    scene.add(floor);
    const circle = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 40), new THREE.MeshBasicMaterial({ color: '#0a887d', side: THREE.DoubleSide }));
    circle.rotation.x = -Math.PI / 2;
    circle.visible = false;
    scene.add(circle);
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const destination = new THREE.Vector3();
    const headsetPosition = new THREE.Vector3();
    const controllers: ReturnType<typeof renderer.xr.getController>[] = [];
    const selectListeners: (() => void)[] = [];
    const getDestination = (controller: THREE.Group) => {
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).transformDirection(controller.matrixWorld);
      return raycaster.ray.direction.y < -0.02 && raycaster.ray.intersectPlane(ground, destination) && destination.distanceTo(raycaster.ray.origin) < 30;
    };
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: '#46dcc0', transparent: true, opacity: 0.7 }));
      ray.scale.z = 12;
      controller.add(ray);
      rig.add(controller);
      const select = () => {
        if (!renderer.xr.isPresenting || !getDestination(controller)) return;
        renderer.xr.getCamera().getWorldPosition(headsetPosition);
        rig.position.x += destination.x - headsetPosition.x;
        rig.position.z += destination.z - headsetPosition.z;
      };
      controller.addEventListener('selectstart', select);
      controllers.push(controller);
      selectListeners.push(select);
    }

    const reset = () => {
      if (renderer.xr.isPresenting) return;
      rig.position.set(0, 0, 0);
      camera.position.copy(fittedPosition);
      controls.target.copy(fittedTarget);
      controls.update();
    };
    const fitModel = () => {
      if (!modelSize) return;
      const size = modelSize;
      fittedTarget = new THREE.Vector3(0, size.y * 0.46, 0);
      const direction = new THREE.Vector3(0.66, 0.42, 0.75).normalize();
      const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const verticalSlope = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const horizontalSlope = verticalSlope * camera.aspect;
      fittedDistance = 0;
      for (const x of [-size.x / 2, size.x / 2]) for (const y of [0, size.y]) for (const z of [-size.z / 2, size.z / 2]) {
        const corner = new THREE.Vector3(x, y, z).sub(fittedTarget);
        const depth = corner.dot(direction);
        fittedDistance = Math.max(fittedDistance, depth + Math.abs(corner.dot(right)) / horizontalSlope, depth + Math.abs(corner.dot(up)) / verticalSlope);
      }
      fittedDistance *= 1.14;
      fittedPosition = direction.multiplyScalar(fittedDistance).add(fittedTarget);
      controls.minDistance = Math.max(size.length() * 0.12, 0.5);
      controls.maxDistance = fittedDistance * 3;
      reset();
    };
    const endSession = () => {
      session = null;
      if (disposed) return;
      controls.enabled = true;
      rig.position.set(0, 0, 0);
      circle.visible = false;
      reset();
      setXRActive(false);
    };
    runtimeRef.current = {
      reset,
      zoom: (factor) => {
        if (renderer.xr.isPresenting) return;
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
      },
      rotate: (enabled) => { controls.autoRotate = enabled; },
      startXR: async () => {
        if (!navigator.xr || session || !model || disposed) return;
        const options: XRSessionInit = { optionalFeatures: ['local-floor', 'bounded-floor'] };
        if (xrOverlayRef.current) {
          options.optionalFeatures?.push('dom-overlay');
          options.domOverlay = { root: xrOverlayRef.current };
        }
        const nextSession = await navigator.xr.requestSession('immersive-vr', options);
        if (disposed) { await nextSession.end(); return; }
        session = nextSession;
        controls.enabled = false;
        controls.autoRotate = false;
        rig.position.set(0, 0, Math.max(fittedDistance * 0.6, 5));
        camera.position.set(0, 1.65, 0);
        camera.rotation.set(0, 0, 0);
        try { await renderer.xr.setSession(nextSession); }
        catch (error) {
          await nextSession.end().catch(() => {});
          endSession();
          throw error;
        }
        if (disposed) { await nextSession.end().catch(() => {}); return; }
        session.addEventListener('end', endSession, { once: true });
        setXRActive(true);
        setRotating(false);
      },
      endXR: async () => { if (session) await session.end().catch(() => {}); },
    };
    reset();
    const resize = () => {
      if (disposed) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || renderer.xr.isPresenting) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitModel();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) { setFailed(true); setLoading(false); }
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    new GLTFLoader().load(object.modelUrl, (gltf) => {
      if (disposed) { disposeObject(gltf.scene); return; }
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      modelOffset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
      model.position.add(modelOffset);
      model.traverse((item) => {
        if ((item as THREE.Mesh).isMesh) {
          (item as THREE.Mesh).castShadow = true;
          (item as THREE.Mesh).receiveShadow = true;
        }
      });
      scene.add(model);
      modelSize = size;
      fitModel();
      setLoading(false);
      setProgress(100);
    }, (event) => {
      if (!disposed && event.total > 0) setProgress(Math.round(event.loaded / event.total * 100));
    }, () => {
      if (!disposed) { setFailed(true); setLoading(false); }
    });

    const projected = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      if (disposed) return;
      if (!renderer.xr.isPresenting) controls.update();
      renderer.render(scene, camera);
      if (renderer.xr.isPresenting) {
        const controller = controllers.find((item) => item.visible && getDestination(item));
        circle.visible = Boolean(controller);
        if (controller) { circle.position.copy(destination); circle.position.y = 0.025; }
      }
      object.hotspots.forEach((point, index) => {
        const button = hotspotRefs.current[index];
        if (!button) return;
        projected.fromArray(point.position).add(modelOffset).project(camera);
        const visible = Boolean(model) && !renderer.xr.isPresenting && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
        button.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) button.style.transform = `translate(-50%, -50%) translate(${(projected.x * 0.5 + 0.5) * host.clientWidth}px, ${(-projected.y * 0.5 + 0.5) * host.clientHeight}px)`;
      });
    });

    return () => {
      disposed = true;
      runtimeRef.current = null;
      if (session) { session.removeEventListener('end', endSession); void session.end().catch(() => {}); }
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controllers.forEach((controller, index) => controller.removeEventListener('selectstart', selectListeners[index]));
      controls.dispose();
      disposeObject(scene);
      keyLight.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // The scene only depends on the selected model. UI language does not reload its GPU assets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id, object.modelUrl, retry]);

  const toggleRotation = () => {
    const next = !rotating;
    setRotating(next);
    runtimeRef.current?.rotate(next);
  };
  const openVR = () => {
    if (xrActive) { void runtimeRef.current?.endXR(); return; }
    if (xrSupport.supported) setShowSafety(true);
    else { setShowFallback(true); setRotating(true); runtimeRef.current?.rotate(true); }
  };
  const enterXR = async () => {
    setXRStarting(true);
    setNotice('');
    try {
      await runtimeRef.current?.startXR();
      setShowSafety(false);
    } catch { setNotice(t.vrFailed); }
    finally { setXRStarting(false); }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dialogRef.current?.requestFullscreen();
    } catch { setNotice(t.fullscreenFailed); }
  };
  const narrate = () => {
    setShowTranscript(true);
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('kk'));
    setVoiceAvailable(Boolean(voice));
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== 'interrupted' && event.error !== 'canceled') setNotice(t.soundFailed);
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="model-viewer" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="model-viewer-title" tabIndex={-1}>
      <header className="model-viewer-header">
        <button className="model-viewer-back" onClick={close} aria-label={t.back}><ArrowLeft size={18} /><span>{t.back}</span></button>
        <div className="model-viewer-header-brand">QAZAQSTAN <span>3D</span></div>
        <button className="model-viewer-icon" onClick={close} aria-label={t.close}><X size={21} /></button>
      </header>
      <div className="model-viewer-stage">
        <div className="model-viewer-canvas" ref={hostRef} data-testid="model-canvas" data-model-loaded={!loading && !failed ? object.id : undefined} />
        <div className="model-viewer-title-block"><span className="model-viewer-eyebrow"><span />{t.exhibit}</span><h2 id="model-viewer-title">{object.title[lang]}</h2><p><Box size={14} />{t.approximate}</p></div>
        <div className="model-viewer-hotspots" aria-label={t.detail}>
          {object.hotspots.map((point, index) => <button key={index} ref={(element) => { hotspotRefs.current[index] = element; }} className={`model-viewer-point${hotspot === index ? ' is-active' : ''}`} onClick={() => { setHotspot(hotspot === index ? null : index); setShowTranscript(false); }} aria-label={point.title[lang]} aria-expanded={hotspot === index}>{index + 1}</button>)}
        </div>
        {!loading && !failed && <div className="model-viewer-side-tools">
          <button className="model-viewer-tool" onClick={() => runtimeRef.current?.zoom(0.82)} title={t.zoomIn} aria-label={t.zoomIn}><ZoomIn size={20} /></button>
          <button className="model-viewer-tool" onClick={() => runtimeRef.current?.zoom(1.22)} title={t.zoomOut} aria-label={t.zoomOut}><ZoomOut size={20} /></button>
          <span />
          <button className="model-viewer-tool" onClick={() => runtimeRef.current?.reset()} title={t.reset} aria-label={t.reset}><RotateCcw size={19} /></button>
          <button className="model-viewer-tool" onClick={fullscreen} title={t.fullscreen} aria-label={t.fullscreen}><Expand size={19} /></button>
        </div>}
        {loading && <div className="model-viewer-loading" role="status"><div className="model-viewer-loading-orbit"><Box size={34} /><span /></div><strong>{t.loading}</strong><div className="model-viewer-progress"><i style={{ width: `${progress || 8}%` }} /></div><small>{progress > 0 ? `${progress}%` : '···'}</small></div>}
        {failed && <div className="model-viewer-error" role="alert"><img className="model-viewer-static" src={`/images/models/${object.id}.png`} alt={object.title[lang]} onError={(event) => { event.currentTarget.style.display = 'none'; }} /><h3>{t.failed}</h3><p>{t.failedText}</p><button className="model-viewer-primary" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16} />{t.retry}</button></div>}
        {!loading && !failed && <div className="model-viewer-stage-note"><span /><span>{t.ready}</span><span className="model-viewer-note-line" /><span>{t.hotspot}</span></div>}
        {hotspot !== null && object.hotspots[hotspot] && <aside className="model-viewer-info"><button className="model-viewer-info-close" aria-label={t.close} onClick={() => setHotspot(null)}><X size={17} /></button><span className="model-viewer-panel-label">0{hotspot + 1} / {t.detail}</span><h3>{object.hotspots[hotspot].title[lang]}</h3><p>{object.hotspots[hotspot].description[lang]}</p><button className="model-viewer-next" onClick={() => setHotspot((hotspot + 1) % object.hotspots.length)}>{object.hotspots[(hotspot + 1) % object.hotspots.length].title[lang]}<ChevronRight size={16} /></button></aside>}
        {showTranscript && <aside className="model-viewer-info model-viewer-transcript"><button className="model-viewer-info-close" aria-label={t.close} onClick={() => setShowTranscript(false)}><X size={17} /></button><span className="model-viewer-panel-label">{t.subtitles}</span>{!voiceAvailable && <p className="model-viewer-voice-note"><Info size={17} />{t.noVoice}</p>}<p lang="kk">{transcript}</p></aside>}
        {showFallback && <aside className="model-viewer-fallback"><button className="model-viewer-info-close" aria-label={t.close} onClick={() => setShowFallback(false)}><X size={17} /></button><Maximize2 size={22} /><h3>{t.fallbackTitle}</h3><p>{t.fallbackText}</p></aside>}
      </div>
      <footer className="model-viewer-footer">
        <div className="model-viewer-instructions"><span><MousePointer2 size={16} />{t.drag}</span><span className="model-viewer-desktop-tip"><ZoomIn size={16} />{t.scroll}</span><span className="model-viewer-touch-tip"><Hand size={16} />{t.touch}</span></div>
        <div className="model-viewer-actions"><button className={`model-viewer-secondary${rotating ? ' is-active' : ''}`} disabled={loading || failed || xrActive} onClick={toggleRotation} aria-pressed={rotating} aria-label={t.rotate}><RotateCw size={17} /><span>{t.rotate}</span></button><button className={`model-viewer-secondary${speaking ? ' is-active' : ''}`} onClick={narrate}>{speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>{speaking ? t.stop : t.guide}</span></button><button className="model-viewer-primary" disabled={loading || failed || !xrSupport.checked} onClick={openVR}><Glasses size={18} />{xrActive ? t.exitVR : xrSupport.supported ? t.vr : t.orbit}</button></div>
      </footer>
      {notice && <div className="model-viewer-notice" role="status"><Info size={18} /><p>{notice}</p><button aria-label={t.close} onClick={() => setNotice('')}><X size={17} /></button></div>}
      {showSafety && <div className="model-viewer-safety-backdrop"><section className="model-viewer-safety" role="alertdialog" aria-modal="true" aria-labelledby="model-viewer-safety-title"><div className="model-viewer-safety-icon"><Glasses size={30} /></div><h3 id="model-viewer-safety-title">{t.safetyTitle}</h3><p>{t.safetyText}</p><div className="model-viewer-safety-controls"><Check size={20} /><p>{t.safetyControls}</p></div><div><button className="model-viewer-secondary" disabled={xrStarting} onClick={() => setShowSafety(false)}>{t.cancel}</button><button className="model-viewer-primary" disabled={xrStarting} onClick={enterXR}>{xrStarting ? <LoaderCircle className="model-viewer-spin" size={18} /> : <Glasses size={18} />}{t.enter}</button></div></section></div>}
      <div className={`model-viewer-xr-overlay${xrActive ? ' is-active' : ''}`} ref={xrOverlayRef}><button className="model-viewer-primary" onClick={() => { void runtimeRef.current?.endXR(); }}><X size={18} />{t.exitVR}</button><p>{t.safetyControls}</p></div>
    </div>
  );
}
