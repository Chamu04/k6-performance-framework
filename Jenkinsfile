pipeline {
    agent any

    options {
        timeout(time: 15, unit: 'MINUTES')
    }

    parameters {
        choice(
            name: 'ENVIRONMENT_TYPE',
            choices: ['Demo_Sandbox', 'Safe_Sandbox_Mock', 'Test_Server_Forms'],
            description: 'Target test environment. Demo_Sandbox & Safe_Sandbox_Mock target external sandboxes.'
        )
        string(
            name: 'TEST_SERVER_ID',
            defaultValue: 'test1',
            description: 'Server ID prefix (used when targeting internal test servers)'
        )
        choice(
            name: 'DEVICE_TYPE',
            choices: ['desktop', 'mobile'],
            description: 'Device layout and user-agent emulation'
        )
        string(
            name: 'PATH_OR_ENDPOINT',
            defaultValue: '/order/ncf',
            description: 'Base form page path'
        )
        string(
            name: 'FULL_URL_OVERRIDE',
            defaultValue: '',
            description: 'Optional complete direct URL override'
        )
        choice(
            name: 'PROFILE',
            choices: ['load', 'smoke', 'stress', 'spike'],
            description: 'k6 workload concurrency profile'
        )
    }

    stages {
        stage('Initialize & Clean Workspace') {
            steps {
                bat '''
                    if not exist "reports" mkdir reports
                '''
            }
        }

        stage('Execute k6 Performance Tests') {
            steps {
                dir('scripts') {
                    bat """
                        k6 run ^
                        --insecure-skip-tls-verify ^
                        -e ENVIRONMENT_TYPE="${params.ENVIRONMENT_TYPE}" ^
                        -e TEST_SERVER_ID="${params.TEST_SERVER_ID}" ^
                        -e DEVICE_TYPE="${params.DEVICE_TYPE}" ^
                        -e PATH_OR_ENDPOINT="${params.PATH_OR_ENDPOINT}" ^
                        -e FULL_URL_OVERRIDE="${params.FULL_URL_OVERRIDE}" ^
                        -e PROFILE="${params.PROFILE}" ^
                        url_load_test.js
                    """
                }
            }
        }
    }

    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports',
                reportFiles: 'summary.html',
                reportName: 'k6 Performance HTML Report',
                reportTitles: 'k6 Performance Summary'
            ])

            junit allowEmptyResults: true, testResults: 'reports/junit.xml'
            archiveArtifacts artifacts: 'reports/*.*', allowEmptyArchive: true
        }
        success {
            echo "k6 load test execution completed successfully within SLA thresholds."
        }
        failure {
            echo "k6 performance run encountered failures or exceeded thresholds. Inspect reports/summary.html for details."
        }
    }
}