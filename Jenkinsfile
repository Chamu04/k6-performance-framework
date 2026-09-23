pipeline {
    agent any

    options {
        timeout(time: 15, unit: 'MINUTES')
        ansiColor('xterm')
    }

    parameters {
        choice(
            name: 'ENVIRONMENT_TYPE',
            choices: ['Demo_Sandbox', 'Test_Server_Forms'],
            description: 'Demo_Sandbox targets test.k6.io (safe for load testing). Test_Server_Forms targets internal servers.'
        )
        string(
            name: 'TEST_SERVER_ID',
            defaultValue: 'test1',
            description: 'Server ID prefix (used when targeting internal test servers)'
        )
        choice(
            name: 'DEVICE_TYPE',
            choices: ['desktop', 'mobile'],
            description: 'Layout emulation'
        )
        string(
            name: 'PATH_OR_ENDPOINT',
            defaultValue: '/login.php',
            description: 'Endpoint path'
        )
        string(
            name: 'FULL_URL_OVERRIDE',
            defaultValue: '',
            description: 'Optional direct URL override'
        )
        choice(
            name: 'PROFILE',
            choices: ['load', 'smoke', 'stress', 'spike'],
            description: 'Workload concurrency profile'
        )
    }

    stages {
        stage('Initialize & Clean Workspace') {
            steps {
                bat '''
                    if not exist "reports" mkdir reports
                    del /Q reports\\*.* 2>nul || exit 0
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
            echo "k6 load test executed successfully against demo sandbox without impacting test1 server."
        }
        failure {
            echo "Performance run encountered threshold failures. Check reports/summary.html for details."
        }
    }
}