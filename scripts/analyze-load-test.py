#!/usr/bin/env python3
"""
Load Test Analysis Script for Party Puzzle Palooza
Analyzes k6 results and system metrics to generate performance reports.
"""

import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import argparse
import sys
import os

def load_k6_results(results_file):
    """Load and parse k6 results JSON file."""
    try:
        with open(results_file, 'r') as f:
            data = json.load(f)
        return data
    except FileNotFoundError:
        print(f"❌ Results file not found: {results_file}")
        return None
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON in results file: {results_file}")
        return None

def load_system_metrics(metrics_file):
    """Load system metrics CSV file."""
    try:
        df = pd.read_csv(metrics_file, names=['timestamp', 'cpu', 'memory', 'db_connections', 'redis_connections'])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df
    except FileNotFoundError:
        print(f"⚠️  System metrics file not found: {metrics_file}")
        return None
    except Exception as e:
        print(f"❌ Error loading system metrics: {e}")
        return None

def analyze_performance(k6_data):
    """Analyze k6 performance metrics."""
    if not k6_data:
        return None
    
    metrics = k6_data.get('metrics', {})
    
    analysis = {
        'http_requests': {
            'total': metrics.get('http_reqs', {}).get('count', 0),
            'rate': metrics.get('http_reqs', {}).get('rate', 0),
            'p95': metrics.get('http_req_duration', {}).get('p(95)', 0),
            'p99': metrics.get('http_req_duration', {}).get('p(99)', 0),
            'failed_rate': metrics.get('http_req_failed', {}).get('rate', 0),
        },
        'websocket': {
            'latency_p95': metrics.get('ws_latency_ms', {}).get('p(95)', 0),
            'messages_total': metrics.get('ws_messages_total', {}).get('count', 0),
        },
        'business_metrics': {
            'room_creation_success': metrics.get('room_creation_success', {}).get('rate', 0),
            'game_join_success': metrics.get('game_join_success', {}).get('rate', 0),
            'question_flag_success': metrics.get('question_flag_success', {}).get('rate', 0),
        },
        'test_duration': k6_data.get('state', {}).get('testRunDuration', 0),
        'max_vus': k6_data.get('state', {}).get('maxVUs', 0),
    }
    
    return analysis

def analyze_system_metrics(system_df):
    """Analyze system resource utilization."""
    if system_df is None or system_df.empty:
        return None
    
    analysis = {
        'cpu': {
            'mean': system_df['cpu'].mean(),
            'max': system_df['cpu'].max(),
            'p95': system_df['cpu'].quantile(0.95),
        },
        'memory': {
            'mean': system_df['memory'].mean(),
            'max': system_df['memory'].max(),
            'p95': system_df['memory'].quantile(0.95),
        },
        'database_connections': {
            'mean': system_df['db_connections'].mean(),
            'max': system_df['db_connections'].max(),
            'p95': system_df['db_connections'].quantile(0.95),
        },
        'redis_connections': {
            'mean': system_df['redis_connections'].mean(),
            'max': system_df['redis_connections'].max(),
            'p95': system_df['redis_connections'].quantile(0.95),
        },
    }
    
    return analysis

def generate_graphs(k6_data, system_df, output_dir):
    """Generate performance graphs."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Set up the plotting style
    plt.style.use('seaborn-v0_8')
    sns.set_palette("husl")
    
    # Create figure with subplots
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle('Party Puzzle Palooza Load Test Analysis', fontsize=16, fontweight='bold')
    
    # 1. HTTP Response Time Distribution
    if k6_data and 'metrics' in k6_data:
        metrics = k6_data['metrics']
        if 'http_req_duration' in metrics:
            duration_data = metrics['http_req_duration']
            percentiles = ['p(50)', 'p(90)', 'p(95)', 'p(99)']
            values = [duration_data.get(p, 0) for p in percentiles]
            
            axes[0, 0].bar(percentiles, values, color=['green', 'yellow', 'orange', 'red'])
            axes[0, 0].set_title('HTTP Response Time Percentiles')
            axes[0, 0].set_ylabel('Response Time (ms)')
            axes[0, 0].tick_params(axis='x', rotation=45)
            
            # Add threshold line
            axes[0, 0].axhline(y=300, color='red', linestyle='--', alpha=0.7, label='Threshold (300ms)')
            axes[0, 0].legend()
    
    # 2. System CPU Usage
    if system_df is not None:
        axes[0, 1].plot(system_df['timestamp'], system_df['cpu'], linewidth=2)
        axes[0, 1].set_title('CPU Usage Over Time')
        axes[0, 1].set_ylabel('CPU Usage (%)')
        axes[0, 1].tick_params(axis='x', rotation=45)
        axes[0, 1].axhline(y=80, color='red', linestyle='--', alpha=0.7, label='Warning (80%)')
        axes[0, 1].legend()
    
    # 3. Database Connections
    if system_df is not None:
        axes[0, 2].plot(system_df['timestamp'], system_df['db_connections'], linewidth=2, color='blue')
        axes[0, 2].set_title('Database Connections Over Time')
        axes[0, 2].set_ylabel('Connections')
        axes[0, 2].tick_params(axis='x', rotation=45)
        axes[0, 2].axhline(y=100, color='red', linestyle='--', alpha=0.7, label='Limit (100)')
        axes[0, 2].legend()
    
    # 4. Redis Connections
    if system_df is not None:
        axes[1, 0].plot(system_df['timestamp'], system_df['redis_connections'], linewidth=2, color='green')
        axes[1, 0].set_title('Redis Connections Over Time')
        axes[1, 0].set_ylabel('Connections')
        axes[1, 0].tick_params(axis='x', rotation=45)
        axes[1, 0].axhline(y=500, color='red', linestyle='--', alpha=0.7, label='Limit (500)')
        axes[1, 0].legend()
    
    # 5. Memory Usage
    if system_df is not None:
        axes[1, 1].plot(system_df['timestamp'], system_df['memory'], linewidth=2, color='purple')
        axes[1, 1].set_title('Memory Usage Over Time')
        axes[1, 1].set_ylabel('Memory (pages)')
        axes[1, 1].tick_params(axis='x', rotation=45)
    
    # 6. Business Metrics
    if k6_data and 'metrics' in k6_data:
        metrics = k6_data['metrics']
        business_metrics = ['room_creation_success', 'game_join_success', 'question_flag_success']
        values = [metrics.get(m, {}).get('rate', 0) for m in business_metrics]
        labels = ['Room Creation', 'Game Join', 'Question Flag']
        
        colors = ['green' if v > 0.95 else 'yellow' if v > 0.9 else 'red' for v in values]
        axes[1, 2].bar(labels, values, color=colors)
        axes[1, 2].set_title('Business Metrics Success Rates')
        axes[1, 2].set_ylabel('Success Rate')
        axes[1, 2].tick_params(axis='x', rotation=45)
        axes[1, 2].set_ylim(0, 1)
        axes[1, 2].axhline(y=0.95, color='red', linestyle='--', alpha=0.7, label='Threshold (95%)')
        axes[1, 2].legend()
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/load-test-analysis-{datetime.now().strftime("%Y%m%d_%H%M%S")}.png', 
                dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"📈 Graphs saved to {output_dir}")

def generate_report(perf_analysis, sys_analysis, output_dir):
    """Generate comprehensive performance report."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = f"{output_dir}/performance-report-{timestamp}.md"
    
    with open(report_file, 'w') as f:
        f.write("# Party Puzzle Palooza Load Test Performance Report\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Executive Summary
        f.write("## Executive Summary\n\n")
        
        if perf_analysis:
            http_p95 = perf_analysis['http_requests']['p95']
            error_rate = perf_analysis['http_requests']['failed_rate']
            ws_p95 = perf_analysis['websocket']['latency_p95']
            
            f.write("### Key Performance Indicators\n\n")
            f.write(f"- **HTTP Response Time (p95):** {http_p95:.2f}ms\n")
            f.write(f"- **Error Rate:** {error_rate:.2%}\n")
            f.write(f"- **WebSocket Latency (p95):** {ws_p95:.2f}ms\n")
            f.write(f"- **Total Requests:** {perf_analysis['http_requests']['total']:,}\n")
            f.write(f"- **Request Rate:** {perf_analysis['http_requests']['rate']:.2f} req/s\n")
            f.write(f"- **Test Duration:** {perf_analysis['test_duration']/1000000000:.1f}s\n")
            f.write(f"- **Max Virtual Users:** {perf_analysis['max_vus']}\n\n")
            
            # Performance Assessment
            f.write("### Performance Assessment\n\n")
            
            if http_p95 < 300:
                f.write("✅ **HTTP Response Time:** Within acceptable limits\n")
            else:
                f.write("❌ **HTTP Response Time:** Exceeds 300ms threshold\n")
            
            if error_rate < 0.05:
                f.write("✅ **Error Rate:** Within acceptable limits\n")
            else:
                f.write("❌ **Error Rate:** Exceeds 5% threshold\n")
            
            if ws_p95 < 100:
                f.write("✅ **WebSocket Latency:** Within acceptable limits\n")
            else:
                f.write("❌ **WebSocket Latency:** Exceeds 100ms threshold\n")
        
        # System Analysis
        if sys_analysis:
            f.write("\n## System Resource Analysis\n\n")
            
            f.write("### CPU Usage\n")
            f.write(f"- **Average:** {sys_analysis['cpu']['mean']:.1f}%\n")
            f.write(f"- **Peak:** {sys_analysis['cpu']['max']:.1f}%\n")
            f.write(f"- **95th Percentile:** {sys_analysis['cpu']['p95']:.1f}%\n\n")
            
            f.write("### Database Connections\n")
            f.write(f"- **Average:** {sys_analysis['database_connections']['mean']:.1f}\n")
            f.write(f"- **Peak:** {sys_analysis['database_connections']['max']:.0f}\n")
            f.write(f"- **95th Percentile:** {sys_analysis['database_connections']['p95']:.1f}\n\n")
            
            f.write("### Redis Connections\n")
            f.write(f"- **Average:** {sys_analysis['redis_connections']['mean']:.1f}\n")
            f.write(f"- **Peak:** {sys_analysis['redis_connections']['max']:.0f}\n")
            f.write(f"- **95th Percentile:** {sys_analysis['redis_connections']['p95']:.1f}\n\n")
        
        # Recommendations
        f.write("## Recommendations\n\n")
        
        if perf_analysis:
            if perf_analysis['http_requests']['p95'] > 300:
                f.write("- **Optimize HTTP endpoints** that exceed 300ms response time\n")
                f.write("- **Implement caching** for frequently accessed data\n")
                f.write("- **Review database queries** for optimization opportunities\n")
            
            if perf_analysis['http_requests']['failed_rate'] > 0.05:
                f.write("- **Investigate error patterns** and implement error handling\n")
                f.write("- **Review rate limiting** configuration\n")
                f.write("- **Check external service dependencies**\n")
            
            if perf_analysis['websocket']['latency_p95'] > 100:
                f.write("- **Optimize WebSocket message processing**\n")
                f.write("- **Review Redis pub/sub performance**\n")
                f.write("- **Consider WebSocket connection pooling**\n")
        
        if sys_analysis:
            if sys_analysis['cpu']['p95'] > 80:
                f.write("- **Scale horizontally** by adding more API instances\n")
                f.write("- **Optimize CPU-intensive operations**\n")
                f.write("- **Consider async processing** for heavy operations\n")
            
            if sys_analysis['database_connections']['p95'] > 80:
                f.write("- **Increase database connection pool size**\n")
                f.write("- **Implement connection pooling**\n")
                f.write("- **Consider read replicas** for read-heavy operations\n")
            
            if sys_analysis['redis_connections']['p95'] > 400:
                f.write("- **Optimize Redis connection usage**\n")
                f.write("- **Implement connection pooling** for Redis\n")
                f.write("- **Consider Redis clustering** for scale\n")
        
        f.write("\n## Next Steps\n\n")
        f.write("1. **Address critical performance issues** identified above\n")
        f.write("2. **Implement recommended optimizations**\n")
        f.write("3. **Re-run load tests** after optimizations\n")
        f.write("4. **Monitor production performance** continuously\n")
        f.write("5. **Set up automated performance testing** in CI/CD\n")
    
    print(f"📊 Report saved to {report_file}")

def main():
    parser = argparse.ArgumentParser(description='Analyze Party Puzzle Palooza load test results')
    parser.add_argument('--k6-results', required=True, help='Path to k6 results JSON file')
    parser.add_argument('--system-metrics', help='Path to system metrics CSV file')
    parser.add_argument('--output-dir', default='load-test-analysis', help='Output directory for analysis')
    
    args = parser.parse_args()
    
    print("🔍 Analyzing load test results...")
    
    # Load data
    k6_data = load_k6_results(args.k6_results)
    system_df = load_system_metrics(args.system_metrics) if args.system_metrics else None
    
    # Analyze performance
    perf_analysis = analyze_performance(k6_data)
    sys_analysis = analyze_system_metrics(system_df)
    
    # Generate outputs
    generate_graphs(k6_data, system_df, args.output_dir)
    generate_report(perf_analysis, sys_analysis, args.output_dir)
    
    print("✅ Analysis complete!")
    
    # Print summary
    if perf_analysis:
        print(f"\n📈 Performance Summary:")
        print(f"  HTTP p95: {perf_analysis['http_requests']['p95']:.2f}ms")
        print(f"  Error Rate: {perf_analysis['http_requests']['failed_rate']:.2%}")
        print(f"  WS p95: {perf_analysis['websocket']['latency_p95']:.2f}ms")

if __name__ == "__main__":
    main() 