import React, { useState, useRef, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';

const FontCompare = () => {
  const [text, setText] = useState('FontCompare');
  const [fontSize, setFontSize] = useState(64);
  const [baselineOffset, setBaselineOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [lastX, setLastX] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [bottomFont, setBottomFont] = useState({ name: 'Arial', loaded: true });
  const [topFont, setTopFont] = useState({ name: 'Times New Roman', loaded: true });
  const [error, setError] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [topFontScale, setTopFontScale] = useState(1);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const fileInputRefBottom = useRef(null);
  const fileInputRefTop = useRef(null);

  const loadFont = async (file, isTopFont) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fontName = file.name.split('.')[0];
          const fontFace = new FontFace(fontName, e.target.result);
          await fontFace.load();
          document.fonts.add(fontFace);
          if (isTopFont) {
            setTopFont({ name: fontName, loaded: true });
          } else {
            setBottomFont({ name: fontName, loaded: true });
          }
          setError('');
        } catch (err) {
          setError('Invalid font file. Please try another.');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error loading font. Please try again.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e, isTopFont) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.ttf') && !file.name.toLowerCase().endsWith('.otf')) {
      setError('Please upload a .ttf or .otf font file');
      return;
    }
    await loadFont(file, isTopFont);
  };

  const handleFileSelect = async (e, isTopFont) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.ttf') && !file.name.toLowerCase().endsWith('.otf')) {
      setError('Please upload a .ttf or .otf font file');
      return;
    }
    await loadFont(file, isTopFont);
  };

  const handleScaleInputChange = (value) => {
    const numValue = parseFloat(value) / 100;
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, 0.5), 1.5);
      setTopFontScale(clampedValue);
    }
  };

  const calculateRequiredWidth = (ctx, text, fontSize, dpr) => {
    ctx.font = `${fontSize}px "${bottomFont.name}"`;
    const width1 = ctx.measureText(text).width;
    ctx.font = `${fontSize * topFontScale}px "${topFont.name}"`;
    const width2 = ctx.measureText(text).width;
    return Math.max(width1, width2) * dpr + (100 * dpr);
  };

  const renderText = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    const requiredWidth = calculateRequiredWidth(ctx, text, fontSize, dpr);
    const newWidth = Math.max(1000 * dpr, requiredWidth);
    const newHeight = 400 * dpr;
    
    if (newWidth !== canvasWidth) {
      setCanvasWidth(newWidth);
    }
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = '#2B2A2F';
    ctx.fillRect(0, 0, newWidth / dpr, newHeight / dpr);
    
    const baselineY = (newHeight / dpr) / 2 + fontSize / 4;
    
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(newWidth / dpr, baselineY);
    ctx.strokeStyle = '#6565B3';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = `${fontSize}px "${bottomFont.name}"`;
    ctx.fillStyle = '#535355';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 20, baselineY);
    
    ctx.font = `${fontSize * topFontScale}px "${topFont.name}"`;
    ctx.fillStyle = '#E8D5CD';
    ctx.globalAlpha = 0.64;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 20, baselineY + baselineOffset);
    
    ctx.globalAlpha = 1;
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX);
    setLastX(e.pageX);
    setLastTime(Date.now());
    setVelocity(0);
    setIsAnimating(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const currentTime = Date.now();
    const timeElapsed = currentTime - lastTime;
    const dx = e.pageX - lastX;
    
    if (timeElapsed > 0) {
      const newVelocity = (dx / timeElapsed) * 8;
      setVelocity(newVelocity);
    }

    containerRef.current.scrollLeft -= dx;
    setLastX(e.pageX);
    setLastTime(currentTime);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (Math.abs(velocity) > 0.1) {
      setIsAnimating(true);
    }
  };

  const applyElasticBounds = (position, minBound, maxBound) => {
    if (position < minBound) {
      const overscroll = minBound - position;
      return minBound - (overscroll * 0.5 * Math.exp(-overscroll / 100));
    }
    if (position > maxBound) {
      const overscroll = position - maxBound;
      return maxBound + (overscroll * 0.5 * Math.exp(-overscroll / 100));
    }
    return position;
  };

  const animateScroll = () => {
    if (!containerRef.current || Math.abs(velocity) < 0.1) {
      setIsAnimating(false);
      return;
    }

    const maxScroll = containerRef.current.scrollWidth - containerRef.current.clientWidth;
    const newScrollLeft = applyElasticBounds(
      containerRef.current.scrollLeft - velocity,
      0,
      maxScroll
    );

    containerRef.current.scrollLeft = newScrollLeft;
    setVelocity(velocity * 0.92);

    animationRef.current = requestAnimationFrame(animateScroll);
  };

  const handleInputChange = (value, setter, min, max) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.min(Math.max(numValue, min), max);
      setter(clampedValue);
    }
  };

  useEffect(() => {
    if (isAnimating) {
      animationRef.current = requestAnimationFrame(animateScroll);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, velocity]);

  useEffect(() => {
    renderText();
  }, [text, fontSize, bottomFont.name, topFont.name, baselineOffset, topFontScale]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card className="p-6 space-y-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium mb-2">Text</label>
          <Input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full"
            placeholder="Enter text to compare"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Font Size</label>
          <div className="flex gap-4 items-center">
            <div className="flex-grow">
              <Slider
                value={[fontSize]}
                onValueChange={(values) => setFontSize(values[0])}
                min={64}
                max={400}
                step={1}
                className="w-full"
              />
            </div>
            <div className="w-20">
              <Input
                type="number"
                value={fontSize}
                onChange={(e) => handleInputChange(e.target.value, setFontSize, 64, 400)}
                min={64}
                max={400}
                className="w-full"
              />
            </div>
            <span className="text-sm text-gray-500">px</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Top Font Scale</label>
          <div className="flex gap-4 items-center">
            <div className="flex-grow">
              <Slider
                value={[topFontScale]}
                onValueChange={(values) => setTopFontScale(values[0])}
                min={0.5}
                max={1.5}
                step={0.01}
                className="w-full"
              />
            </div>
            <div className="w-20">
              <Input
                type="number"
                value={(topFontScale * 100).toFixed(0)}
                onChange={(e) => handleScaleInputChange(e.target.value)}
                min={50}
                max={150}
                className="w-full"
              />
            </div>
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Baseline Adjustment</label>
          <div className="flex gap-4 items-center">
            <div className="flex-grow">
              <Slider
                value={[baselineOffset]}
                onValueChange={(values) => setBaselineOffset(values[0])}
                min={-50}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
            <div className="w-20">
              <Input
                type="number"
                value={baselineOffset}
                onChange={(e) => handleInputChange(e.target.value, setBaselineOffset, -50, 50)}
                min={-50}
                max={50}
                className="w-full"
              />
            </div>
            <span className="text-sm text-gray-500">px</span>
          </div>
        </div>

        <div
          ref={containerRef}
          className="overflow-x-auto border rounded scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '::-webkit-scrollbar': { display: 'none' }
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <canvas
            ref={canvasRef}
            className="bg-white"
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab',
              width: `${canvasWidth / (window.devicePixelRatio || 1)}px`,
              height: '400px',
              imageRendering: 'crisp-edges'
            }}
          />
        </div>

        <input
          type="file"
          ref={fileInputRefBottom}
          className="hidden"
          accept=".ttf,.otf"
          onChange={(e) => handleFileSelect(e, false)}
        />
        <input
          type="file"
          ref={fileInputRefTop}
          className="hidden"
          accept=".ttf,.otf"
          onChange={(e) => handleFileSelect(e, true)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div
            className="border-2 border-dashed rounded p-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRefBottom.current.click()}
            onDrop={(e) => handleDrop(e, false)}
            onDragOver={handleDragOver}
          >
            <Upload className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              Click or drop bottom font here<br />
              (currently: {bottomFont.name})
            </p>
          </div>
          <div
            className="border-2 border-dashed rounded p-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRefTop.current.click()}
            onDrop={(e) => handleDrop(e, true)}
            onDragOver={handleDragOver}
          >
            <Upload className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              Click or drop top font here<br />
              (currently: {topFont.name})
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FontCompare;
