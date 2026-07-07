<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart, BarElement, LinearScale, CategoryScale,
    Tooltip, Legend, BarController,
    type ChartItem,
  } from 'chart.js';
  import { CATEGORY_COLORS } from '../utils.js';

  Chart.register(BarElement, LinearScale, CategoryScale, Tooltip, Legend, BarController);

  let { data = {}, colorMap = null }: { data: Record<string, number>, colorMap?: any } = $props();
  
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

  let canvas: HTMLCanvasElement;

  let labels = $derived(Object.keys(data));
  let values = $derived(labels.map(l => data[l]));
  let chart: Chart | null = null;

  $effect(() => {
    const l = labels;
    const v = values;
    if (chart && l && v) {
      chart.data.labels = l;
      chart.data.datasets[0].data = v;
      chart.data.datasets[0].backgroundColor = l.map(lbl => 
        (colorMap && colorMap[lbl]) || (CATEGORY_COLORS as Record<string, string>)[lbl] || '#3f3f46'
      );
      chart.update();
    }
  });

  onMount(() => {
    chart = new Chart(canvas as ChartItem, {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Spending',
          data: Object.values(data),
          backgroundColor: Object.keys(data).map(l => 
            (colorMap && colorMap[l]) || (CATEGORY_COLORS as Record<string, string>)[l] || '#3f3f46'
          ),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 40,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { family: FONT, size: 13, weight: 700 },
            bodyFont: { family: FONT, size: 12 },
            padding: 12,
            cornerRadius: 8,
            borderColor: '#27272a',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` $${((ctx.parsed.y ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#71717a',
              font: { family: FONT, size: 11, weight: 600 }
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            ticks: {
              color: '#71717a',
              font: { family: FONT, size: 10, weight: 500 },
              padding: 10,
              callback: v => `$${v}`,
            },
            grid: { color: '#18181b' },
            border: { display: false },
            beginAtZero: true,
          },
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      },
    });
  });

  onDestroy(() => { if (chart) chart.destroy(); });
</script>

<div class="chart-wrapper">
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
  <canvas bind:this={canvas} role="img" aria-label={labels.length ? `Bar chart: ${labels.join(', ')}` : 'Bar chart'}></canvas>
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
