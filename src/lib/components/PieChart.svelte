<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
  import { CATEGORY_COLORS, capitalize } from '../utils.js';

  Chart.register(ArcElement, Tooltip, Legend, PieController);

  let { data = {}, colorMap = null, hideLegend = false } = $props();
  
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

  let labels = $derived(Object.keys(data));
  let values = $derived(labels.map(l => data[l]));

  let canvas;
  let chart;

  $effect(() => {
    const l = labels;
    const v = values;
    if (chart && l && v) {
      chart.data.labels = l.map(capitalize);
      chart.data.datasets[0].data = v;
      chart.data.datasets[0].backgroundColor = l.map(lbl =>
        (colorMap && colorMap[lbl]) || CATEGORY_COLORS[lbl] || '#3f3f46'
      );
      chart.update();
    }
  });

  onMount(() => {
    const labels = Object.keys(data);
    const values = Object.values(data);

    chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: labels.map(capitalize),
        datasets: [{
          data: values,
          backgroundColor: labels.map(l =>
            (colorMap && colorMap[l]) || CATEGORY_COLORS[l] || '#3f3f46'
          ),
          borderColor: '#121214',
          borderWidth: 2,
          hoverOffset: 12,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !hideLegend,
            position: 'bottom',
            labels: {
              color: '#a1a1aa',
              font: { family: FONT, size: 11, weight: 600 },
              padding: 20,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { family: FONT, size: 13, weight: 700 },
            bodyFont: { family: FONT, size: 12 },
            padding: 12,
            cornerRadius: 8,
            borderColor: '#27272a',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.label}: $${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            },
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
  <canvas bind:this={canvas} role="img" aria-label={labels.length ? `Distribution across ${labels.join(', ')}` : 'Distribution chart'}></canvas>
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
